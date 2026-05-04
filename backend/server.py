from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional

import bcrypt
import jwt
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, UploadFile, File, Form
from fastapi.responses import FileResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

UPLOAD_DIR = ROOT_DIR / 'uploads'
UPLOAD_DIR.mkdir(exist_ok=True)

app = FastAPI(title="Boost Growth Portal API")
api = APIRouter(prefix="/api")

JWT_ALGORITHM = "HS256"
JWT_SECRET = os.environ["JWT_SECRET"]

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def hash_password(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()

def verify_password(p: str, h: str) -> bool:
    return bcrypt.checkpw(p.encode(), h.encode())

def create_token(data: dict, hours: int = 24) -> str:
    payload = {**data, "exp": datetime.now(timezone.utc) + timedelta(hours=hours)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = decode_token(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    if payload.get("role") == "admin":
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    else:
        user = await db.therapists.find_one({"id": payload["sub"]}, {"_id": 0, "pin_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    user["role"] = payload.get("role", user.get("role", "therapist"))
    return user

async def admin_only(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

def set_auth_cookie(response: Response, token: str):
    response.set_cookie(key="access_token", value=token, httponly=True,
                        secure=True, samesite="none", max_age=86400, path="/")

# ------------------- Models -------------------
class LoginIn(BaseModel):
    email: EmailStr
    password: str

class TherapistPinLogin(BaseModel):
    therapist_id: str
    pin: str

class TherapistIn(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    color: Optional[str] = "#7A8A6A"
    pin: str

class TherapistUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    color: Optional[str] = None
    pin: Optional[str] = None

class ScheduleCellIn(BaseModel):
    therapist_id: str
    day: int
    time_slot: str
    service_code: Optional[str] = "SS"
    child_name: Optional[str] = None
    note: Optional[str] = None
    custom_time: Optional[str] = None
    state: Optional[str] = "normal"
    color: Optional[str] = None  # explicit hex override (else from child name)
    week_start: str

class LocationIn(BaseModel):
    service: str
    address: str

class ClientIn(BaseModel):
    name: str
    file_no: Optional[str] = None
    age: Optional[str] = None
    parent_name: Optional[str] = None
    parent_phone: Optional[str] = None
    package_hours: Optional[float] = 24
    notes: Optional[str] = None
    main_therapist_id: Optional[str] = None
    co_therapist_ids: Optional[List[str]] = []
    supervisor: Optional[str] = None
    locations: Optional[List[LocationIn]] = []
    color: Optional[str] = None
    drive_url: Optional[str] = None

class SessionIn(BaseModel):
    client_id: str
    session_date: str  # ISO date
    start_time: Optional[str] = None  # "14:00"
    end_time: Optional[str] = None
    hours: float = 0
    status: str = "Completed"  # Completed, No Service, Cancelled, No Show
    therapist_ids: List[str] = []
    note: Optional[str] = None
    location: Optional[str] = None  # which location used (HS / SS)

class RequestIn(BaseModel):
    title: str
    description: Optional[str] = ""
    request_type: str = "general"
    priority: str = "normal"
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    reward_type: Optional[str] = None
    extra_notes: Optional[str] = None

class RequestStatusUpdate(BaseModel):
    status: str
    admin_note: Optional[str] = None

class DirectoryContactIn(BaseModel):
    name: str
    role: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None

class IntakeIn(BaseModel):
    child_name: str
    parent_name: Optional[str] = None
    phone: Optional[str] = None
    intake_type: str = "pre"
    notes: Optional[str] = None
    status: Optional[str] = "new"
    intake_date: Optional[str] = None
    age: Optional[str] = None

# ------------------- Auth -------------------
@api.post("/auth/login")
async def admin_login(payload: LoginIn, response: Response):
    email = payload.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token({"sub": user["id"], "role": "admin", "email": email})
    set_auth_cookie(response, token)
    return {"id": user["id"], "email": email, "name": user.get("name"), "role": "admin", "token": token}

@api.get("/auth/therapists-list")
async def therapists_list_public():
    return await db.therapists.find({}, {"_id": 0, "pin_hash": 0}).sort("name", 1).to_list(500)

@api.post("/auth/therapist-login")
async def therapist_login(payload: TherapistPinLogin, response: Response):
    t = await db.therapists.find_one({"id": payload.therapist_id})
    if not t or not verify_password(payload.pin, t["pin_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect PIN")
    token = create_token({"sub": t["id"], "role": "therapist", "name": t["name"]})
    set_auth_cookie(response, token)
    return {"id": t["id"], "name": t["name"], "color": t.get("color"), "role": "therapist", "token": token}

@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user

@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}

# ------------------- Therapists -------------------
@api.get("/therapists")
async def list_therapists(user=Depends(get_current_user)):
    return await db.therapists.find({}, {"_id": 0, "pin_hash": 0}).sort("name", 1).to_list(500)

@api.post("/therapists")
async def create_therapist(payload: TherapistIn, _=Depends(admin_only)):
    tid = str(uuid.uuid4())
    doc = {"id": tid, "name": payload.name, "email": payload.email, "phone": payload.phone,
           "color": payload.color or "#7A8A6A", "pin_hash": hash_password(payload.pin),
           "created_at": now_iso()}
    await db.therapists.insert_one(doc)
    return {k: v for k, v in doc.items() if k not in ("_id", "pin_hash")}

@api.put("/therapists/{tid}")
async def update_therapist(tid: str, payload: TherapistUpdate, _=Depends(admin_only)):
    update = {k: v for k, v in payload.model_dump().items() if v is not None and k != "pin"}
    if payload.pin:
        update["pin_hash"] = hash_password(payload.pin)
    if not update:
        raise HTTPException(status_code=400, detail="No fields")
    await db.therapists.update_one({"id": tid}, {"$set": update})
    return await db.therapists.find_one({"id": tid}, {"_id": 0, "pin_hash": 0})

@api.delete("/therapists/{tid}")
async def delete_therapist(tid: str, _=Depends(admin_only)):
    await db.therapists.delete_one({"id": tid})
    return {"ok": True}

# ------------------- Schedule -------------------
@api.get("/schedule")
async def list_schedule(week_start: Optional[str] = None, user=Depends(get_current_user)):
    q: dict = {}
    if week_start:
        q["week_start"] = week_start
    cells = await db.schedule_cells.find(q, {"_id": 0}).to_list(5000)
    return cells  # everyone sees full schedule (master view) per user request

async def _notify(user_id: str, ntype: str, title: str, message: str):
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()), "user_id": user_id, "type": ntype,
        "title": title, "message": message, "read": False, "created_at": now_iso(),
    })

@api.post("/schedule")
async def create_schedule_cell(payload: ScheduleCellIn, _=Depends(admin_only)):
    cid = str(uuid.uuid4())
    doc = {"id": cid, **payload.model_dump(), "created_at": now_iso()}
    await db.schedule_cells.insert_one(doc)
    doc.pop("_id", None)
    if doc.get("therapist_id"):
        await _notify(doc["therapist_id"], "schedule", "New session added",
                      f"{doc.get('service_code')} | {doc.get('child_name') or ''} at {doc.get('time_slot')}")
    return doc

@api.put("/schedule/{cid}")
async def update_schedule_cell(cid: str, payload: ScheduleCellIn, _=Depends(admin_only)):
    update = payload.model_dump()
    await db.schedule_cells.update_one({"id": cid}, {"$set": update})
    cell = await db.schedule_cells.find_one({"id": cid}, {"_id": 0})
    if cell and cell.get("therapist_id"):
        title = "Schedule update"
        if cell.get("state") == "cancel_therapist":
            title = "Session marked as Therapist Cancellation"
        elif cell.get("state") == "cancel_child":
            title = "Session marked as Client Cancellation"
        await _notify(cell["therapist_id"], "schedule", title,
                      f"{cell.get('service_code')} | {cell.get('child_name') or ''} at {cell.get('time_slot')}")
    return cell

@api.post("/schedule/{cid}/duplicate")
async def duplicate_cell(cid: str, _=Depends(admin_only)):
    cell = await db.schedule_cells.find_one({"id": cid}, {"_id": 0})
    if not cell:
        raise HTTPException(status_code=404, detail="Not found")
    new_cell = {**cell, "id": str(uuid.uuid4()), "created_at": now_iso()}
    await db.schedule_cells.insert_one(new_cell)
    new_cell.pop("_id", None)
    return new_cell

@api.delete("/schedule/{cid}")
async def delete_schedule_cell(cid: str, _=Depends(admin_only)):
    await db.schedule_cells.delete_one({"id": cid})
    return {"ok": True}

@api.post("/schedule/{cid}/notify")
async def notify_schedule(cid: str, body: dict, _=Depends(admin_only)):
    cell = await db.schedule_cells.find_one({"id": cid}, {"_id": 0})
    if not cell or not cell.get("therapist_id"):
        raise HTTPException(status_code=400, detail="No therapist assigned")
    msg = body.get("message") or f"Notice about session: {cell.get('child_name') or ''}"
    await _notify(cell["therapist_id"], "schedule_alert", "Notice from Admin", msg)
    return {"ok": True}

# ------------------- Clients & Sessions -------------------
@api.get("/clients")
async def list_clients(user=Depends(get_current_user)):
    if user.get("role") == "admin":
        return await db.clients.find({}, {"_id": 0}).sort("file_no", 1).to_list(500)
    # therapist: see only assigned (main or co)
    items = await db.clients.find({}, {"_id": 0}).sort("file_no", 1).to_list(500)
    uid = user["id"]
    return [c for c in items if c.get("main_therapist_id") == uid or uid in (c.get("co_therapist_ids") or [])]

@api.post("/clients")
async def create_client(payload: ClientIn, _=Depends(admin_only)):
    cid = str(uuid.uuid4())
    data = payload.model_dump()
    data["locations"] = [l for l in (data.get("locations") or [])]
    doc = {"id": cid, **data, "created_at": now_iso()}
    await db.clients.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.put("/clients/{cid}")
async def update_client(cid: str, payload: ClientIn, _=Depends(admin_only)):
    data = payload.model_dump()
    data["locations"] = [l for l in (data.get("locations") or [])]
    await db.clients.update_one({"id": cid}, {"$set": data})
    return await db.clients.find_one({"id": cid}, {"_id": 0})

@api.delete("/clients/{cid}")
async def delete_client(cid: str, _=Depends(admin_only)):
    await db.clients.delete_one({"id": cid})
    await db.sessions.delete_many({"client_id": cid})
    return {"ok": True}

# ------------------- Sessions (Attendance log) -------------------
@api.get("/sessions")
async def list_sessions(client_id: Optional[str] = None, user=Depends(get_current_user)):
    q = {}
    if client_id:
        q["client_id"] = client_id
    items = await db.sessions.find(q, {"_id": 0}).sort("session_date", -1).to_list(2000)
    if user.get("role") == "therapist":
        uid = user["id"]
        items = [s for s in items if uid in (s.get("therapist_ids") or [])]
    return items

@api.post("/sessions")
async def create_session(payload: SessionIn, user=Depends(get_current_user)):
    sid = str(uuid.uuid4())
    therapist_ids = payload.therapist_ids or []
    if user.get("role") == "therapist" and user["id"] not in therapist_ids:
        therapist_ids.append(user["id"])
    doc = {"id": sid, **payload.model_dump(), "therapist_ids": therapist_ids,
           "created_by": user["id"], "created_by_role": user["role"],
           "created_at": now_iso()}
    await db.sessions.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.put("/sessions/{sid}")
async def update_session(sid: str, payload: SessionIn, user=Depends(get_current_user)):
    sess = await db.sessions.find_one({"id": sid})
    if not sess:
        raise HTTPException(status_code=404, detail="Not found")
    if user.get("role") != "admin" and user["id"] not in (sess.get("therapist_ids") or []):
        raise HTTPException(status_code=403, detail="Forbidden")
    await db.sessions.update_one({"id": sid}, {"$set": payload.model_dump()})
    return await db.sessions.find_one({"id": sid}, {"_id": 0})

@api.delete("/sessions/{sid}")
async def delete_session(sid: str, user=Depends(get_current_user)):
    sess = await db.sessions.find_one({"id": sid})
    if not sess:
        return {"ok": True}
    if user.get("role") != "admin" and user["id"] not in (sess.get("therapist_ids") or []):
        raise HTTPException(status_code=403, detail="Forbidden")
    await db.sessions.delete_one({"id": sid})
    return {"ok": True}

# ------------------- Attendance Sheets (file upload, kept for backward compat) -------------------
@api.get("/clients/{cid}/sheets")
async def list_sheets(cid: str, user=Depends(get_current_user)):
    return await db.attendance_sheets.find({"client_id": cid}, {"_id": 0}).sort("page_number", 1).to_list(500)

@api.post("/clients/{cid}/sheets")
async def upload_sheet(cid: str,
                      title: str = Form(...),
                      session_date: str = Form(...),
                      therapist_id: Optional[str] = Form(None),
                      notes: Optional[str] = Form(None),
                      file: Optional[UploadFile] = File(None),
                      _=Depends(admin_only)):
    sid = str(uuid.uuid4())
    file_path = None
    file_name = None
    if file:
        ext = Path(file.filename).suffix
        file_name = file.filename
        save_path = UPLOAD_DIR / f"{sid}{ext}"
        save_path.write_bytes(await file.read())
        file_path = f"{sid}{ext}"
    last = await db.attendance_sheets.find_one({"client_id": cid}, sort=[("page_number", -1)])
    page_number = (last.get("page_number", 0) + 1) if last else 1
    doc = {"id": sid, "client_id": cid, "title": title, "session_date": session_date,
           "therapist_id": therapist_id, "notes": notes, "page_number": page_number,
           "file_name": file_name, "file_path": file_path, "created_at": now_iso()}
    await db.attendance_sheets.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.delete("/sheets/{sid}")
async def delete_sheet(sid: str, _=Depends(admin_only)):
    sheet = await db.attendance_sheets.find_one({"id": sid})
    if sheet and sheet.get("file_path"):
        fp = UPLOAD_DIR / sheet["file_path"]
        if fp.exists():
            fp.unlink()
    await db.attendance_sheets.delete_one({"id": sid})
    return {"ok": True}

@api.get("/sheets/{sid}/download")
async def download_sheet(sid: str, user=Depends(get_current_user)):
    sheet = await db.attendance_sheets.find_one({"id": sid}, {"_id": 0})
    if not sheet or not sheet.get("file_path"):
        raise HTTPException(status_code=404, detail="No file")
    fp = UPLOAD_DIR / sheet["file_path"]
    return FileResponse(str(fp), filename=sheet.get("file_name") or sheet["file_path"])

# ------------------- Requests -------------------
@api.get("/requests")
async def list_requests(user=Depends(get_current_user)):
    q = {} if user.get("role") == "admin" else {"therapist_id": user["id"]}
    return await db.requests.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)

@api.post("/requests")
async def create_request(payload: RequestIn, user=Depends(get_current_user)):
    if user.get("role") != "therapist":
        raise HTTPException(status_code=403, detail="Therapist only")
    rid = str(uuid.uuid4())
    doc = {"id": rid, "therapist_id": user["id"], "therapist_name": user.get("name"),
           **payload.model_dump(), "status": "pending", "admin_note": None,
           "created_at": now_iso(), "updated_at": now_iso(),
           "timeline": [{"event": "submitted", "at": now_iso(), "by": user.get("name")}]}
    await db.requests.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.put("/requests/{rid}/status")
async def update_request_status(rid: str, payload: RequestStatusUpdate, admin=Depends(admin_only)):
    req = await db.requests.find_one({"id": rid})
    if not req:
        raise HTTPException(status_code=404, detail="Not found")
    timeline = req.get("timeline", [])
    timeline.append({"event": payload.status, "at": now_iso(), "by": admin.get("name") or "Admin",
                     "note": payload.admin_note})
    await db.requests.update_one({"id": rid}, {"$set": {
        "status": payload.status, "admin_note": payload.admin_note,
        "updated_at": now_iso(), "timeline": timeline,
    }})
    status_map = {"pending": "Pending", "in_progress": "In Progress",
                  "approved": "Approved", "rejected": "Rejected", "done": "Completed"}
    await _notify(req["therapist_id"], "request", "Request update",
                  f"Your request '{req['title']}' is now: {status_map.get(payload.status, payload.status)}")
    return await db.requests.find_one({"id": rid}, {"_id": 0})

@api.delete("/requests/{rid}")
async def delete_request(rid: str, user=Depends(get_current_user)):
    req = await db.requests.find_one({"id": rid})
    if not req:
        return {"ok": True}
    if user.get("role") != "admin" and req.get("therapist_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    await db.requests.delete_one({"id": rid})
    return {"ok": True}

# ------------------- Notifications -------------------
@api.get("/notifications")
async def list_notifications(user=Depends(get_current_user)):
    return await db.notifications.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).limit(100).to_list(100)

@api.post("/notifications/{nid}/read")
async def mark_read(nid: str, user=Depends(get_current_user)):
    await db.notifications.update_one({"id": nid, "user_id": user["id"]}, {"$set": {"read": True}})
    return {"ok": True}

@api.post("/notifications/read-all")
async def mark_all_read(user=Depends(get_current_user)):
    await db.notifications.update_many({"user_id": user["id"]}, {"$set": {"read": True}})
    return {"ok": True}

# ------------------- Directory -------------------
@api.get("/directory")
async def list_directory(user=Depends(get_current_user)):
    return await db.directory.find({}, {"_id": 0}).to_list(500)

@api.post("/directory")
async def create_contact(payload: DirectoryContactIn, _=Depends(admin_only)):
    cid = str(uuid.uuid4())
    doc = {"id": cid, **payload.model_dump(), "created_at": now_iso()}
    await db.directory.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.delete("/directory/{cid}")
async def delete_contact(cid: str, _=Depends(admin_only)):
    await db.directory.delete_one({"id": cid})
    return {"ok": True}

# ------------------- Intake (admin only) -------------------
@api.get("/intake")
async def list_intake(_=Depends(admin_only)):
    return await db.intake.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)

@api.post("/intake")
async def create_intake(payload: IntakeIn, _=Depends(admin_only)):
    iid = str(uuid.uuid4())
    doc = {"id": iid, **payload.model_dump(), "created_at": now_iso()}
    await db.intake.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.put("/intake/{iid}")
async def update_intake(iid: str, payload: IntakeIn, _=Depends(admin_only)):
    await db.intake.update_one({"id": iid}, {"$set": payload.model_dump()})
    return await db.intake.find_one({"id": iid}, {"_id": 0})

@api.delete("/intake/{iid}")
async def delete_intake(iid: str, _=Depends(admin_only)):
    await db.intake.delete_one({"id": iid})
    return {"ok": True}

@api.get("/")
async def root():
    return {"message": "Boost Growth Portal API", "status": "ok"}

app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ------------------- Seed Data (FROM BASE44 SOURCE) -------------------
THERAPIST_SEED = [
    {"name": "Ms. Maha", "color": "#7A8A6A", "email": "maha@boostgrowthsa.com"},
    {"name": "Ms. Fahda", "color": "#D4A64A", "email": "fahda@boostgrowthsa.com"},
    {"name": "Ms. Razan", "color": "#8FA481", "email": "razan@boostgrowthsa.com"},
    {"name": "Ms. Manal", "color": "#A4BCCB", "email": "manal@boostgrowthsa.com"},
    {"name": "Ms. Hajer", "color": "#C97B5C", "email": "hajer@boostgrowthsa.com"},
    {"name": "Ms. Rahaf", "color": "#9B7BAB", "email": "rahaf@boostgrowthsa.com"},
    {"name": "Ms. Shatha", "color": "#5C8B7E", "email": "shatha@boostgrowthsa.com"},
    {"name": "Ms. Alhanouf", "color": "#B89968", "email": "alhanouf@boostgrowthsa.com"},
    {"name": "Ms. Waad", "color": "#7B96B5", "email": "waad@boostgrowthsa.com"},
    {"name": "Ms. Bodoor", "color": "#A8745E", "email": "bodoor@boostgrowthsa.com"},
    {"name": "Ms. Fatimah", "color": "#6B9080", "email": "fatimah@boostgrowthsa.com"},
    {"name": "Ms. Shrooq", "color": "#D49A60", "email": "shrooq@boostgrowthsa.com"},
    {"name": "Ms. Abeer", "color": "#8B7BA8", "email": "abeer@boostgrowthsa.com"},
]

CLIENT_SEED = [
    {"file_no":"009","name":"Saleh Ahusainy","main":"Ms. Waad","co":["Ms. Manal","Ms. Fahda"],"pkg":24,"sup":"Ms. Fahda","color":"#FFE599","locs":[{"service":"SS","address":"Alnakeel - Home Sweet Home"},{"service":"HS","address":"Alnakheel - 1st floor, apartment #7"}]},
    {"file_no":"011","name":"Fahad Alyahya","main":"Ms. Alhanouf","co":["Ms. Fahda"],"pkg":24,"sup":"Ms. Fahda","color":"#A2C4C9","locs":[{"service":"HS","address":"Alyasmin - house no 3075"},{"service":"SS","address":"Talat School"}]},
    {"file_no":"024","name":"Abdulaziz Alrasheed","main":"Ms. Shatha","co":["Ms. Manal","Ms. Hajer"],"pkg":24,"sup":"Ms. Fahda","color":"#D5A6BD","locs":[{"service":"HS","address":"Alnada - Building #26, 3rd floor, apartment #23"}]},
    {"file_no":"027","name":"Mohammed Alaqel","main":"Ms. Rahaf","co":["Ms. Fahda"],"pkg":24,"sup":"Ms. Fahda","color":"#E6B8AF","locs":[{"service":"HS","address":"AlMalqa - 331"},{"service":"SS","address":"Education & Skills International Schools"}]},
    {"file_no":"034","name":"Aljouhrah Alduailij","main":"Ms. Fahda","co":[],"pkg":24,"sup":"Ms. Fahda","color":"#B4A7D6","locs":[{"service":"SS","address":"Alnakheel - Talat School"}]},
    {"file_no":"035","name":"Saad Alghamdi","main":"Ms. Fatimah","co":["Ms. Hajer","Ms. Shatha"],"pkg":24,"sup":"Ms. Maha","color":"#D9EAD3","locs":[{"service":"SS","address":"Al Motaqdimah Schools"},{"service":"HS","address":"Al Aqiq - House in the corner"}]},
    {"file_no":"038","name":"Salman Alrasheed","main":"Ms. Manal","co":["Ms. Fahda"],"pkg":24,"sup":"Ms. Maha","color":"#B6D7A8","locs":[{"service":"SS","address":"Stars of Knowledge School"},{"service":"HS","address":"Alnada - Building #26, 3rd floor, apartment #23"}]},
    {"file_no":"040","name":"Abdulaziz AlAbdulwahab","main":"Ms. Fatimah","co":["Ms. Fahda","Ms. Hajer"],"pkg":24,"sup":"Ms. Maha","color":"#FCE5CD","locs":[{"service":"HS","address":"Alraed - house no 8188"}]},
    {"file_no":"041","name":"Ameerah Alshehri","main":"Ms. Fahda","co":["Ms. Fatimah"],"pkg":24,"sup":"Ms. Maha","color":"#F4CCCC","locs":[{"service":"HS","address":"Roshen - Villa 277"}]},
    {"file_no":"042","name":"Sultan Aldamer","main":"Ms. Shrooq","co":["Ms. Rahaf","Ms. Manal"],"pkg":24,"sup":"Ms. Maha","color":"#6FA8DC","locs":[{"service":"SS","address":"Bright Mind School"},{"service":"HS","address":"Alhada - No house number"}]},
    {"file_no":"047","name":"Alwaleed Alotaibi","main":"Ms. Hajer","co":["Ms. Alhanouf"],"pkg":24,"sup":"Ms. Maha","color":"#EA9999","locs":[{"service":"HS","address":"Alqairawan - house no 10"},{"service":"SS","address":"Al Motaqdimah Schools"}]},
    {"file_no":"052","name":"Sulaiman Alkhurashi","main":"Ms. Rahaf","co":["Ms. Maha"],"pkg":24,"sup":"Ms. Maha","color":"#FFE599","locs":[{"service":"HS","address":"Alsulaimanyah - house no 24"}]},
    {"file_no":"054","name":"Omar Alkhurashi","main":"Ms. Manal","co":["Ms. Maha"],"pkg":24,"sup":"Ms. Maha","color":"#B4A7D6","locs":[{"service":"HS","address":"Alsulaimanyah - house no 24"}]},
    {"file_no":"060","name":"Mohammed Albedayea","main":"Ms. Bodoor","co":["Ms. Shatha"],"pkg":24,"sup":"Ms. Maha","color":"#F9CB9C","locs":[{"service":"HS","address":"Alyasmin - Home no 14"},{"service":"SS","address":"Yas School"}]},
    {"file_no":"061","name":"Ibrahim Alnasir","main":"Ms. Rahaf","co":["Ms. Fahda"],"pkg":24,"sup":"Ms. Fahda","color":"#D0E0E3","locs":[{"service":"HS","address":"Alyasmin - Home no 39"},{"service":"SS","address":"Alnakheel - Talat School"}]},
    {"file_no":"062","name":"Lulu Almutair","main":"Ms. Razan","co":["Ms. Fahda"],"pkg":24,"sup":"Ms. Fahda","color":"#D5A6BD","locs":[{"service":"HS","address":"Almuroj - Home no 4"},{"service":"SS","address":"Alnakheel - Talat School"}]},
    {"file_no":"063","name":"Amani Ghaith","main":"Ms. Maha","co":[],"pkg":24,"sup":"Ms. Maha","color":"#A2C4C9","locs":[{"service":"HS","address":"Alnakheel"}]},
    {"file_no":"068","name":"Abdulrahman Alshawi","main":"Ms. Razan","co":["Ms. Fahda"],"pkg":24,"sup":"Ms. Fahda","color":"#D9EAD3","locs":[{"service":"HS","address":"AR Rayan - Home no 32"},{"service":"SS","address":"Kindergarten of KSU"}]},
    {"file_no":"070","name":"Abdulelah Almuhana","main":"Ms. Abeer","co":["Ms. Maha"],"pkg":24,"sup":"Ms. Maha","color":"#D9D2E9","locs":[{"service":"SS","address":"Manarat Ar Riyadh"}]},
    {"file_no":"072","name":"Khalid Bin Shuael","main":"Ms. Shatha","co":["Ms. Fahda"],"pkg":24,"sup":"Ms. Fahda","color":"#FFF2CC","locs":[{"service":"HS","address":"AlMursalat"}]},
]

@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.therapists.create_index("id", unique=True)
    await db.schedule_cells.create_index([("week_start", 1), ("therapist_id", 1)])
    await db.notifications.create_index("user_id")
    await db.sessions.create_index([("client_id", 1), ("session_date", -1)])

    admin_email = os.environ["ADMIN_EMAIL"].lower()
    admin_password = os.environ["ADMIN_PASSWORD"]
    admin_name = os.environ.get("ADMIN_NAME", "Admin")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({"id": str(uuid.uuid4()), "email": admin_email,
                                   "password_hash": hash_password(admin_password),
                                   "name": admin_name, "role": "admin", "created_at": now_iso()})
        logger.info(f"Admin seeded: {admin_email}")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})

    # Seed therapists if missing or count mismatch
    th_count = await db.therapists.count_documents({})
    if th_count != len(THERAPIST_SEED):
        await db.therapists.delete_many({})
        for s in THERAPIST_SEED:
            await db.therapists.insert_one({
                "id": str(uuid.uuid4()), "name": s["name"], "color": s["color"],
                "email": s.get("email"), "phone": None,
                "pin_hash": hash_password("0000"),
                "created_at": now_iso(),
            })
        logger.info(f"Seeded {len(THERAPIST_SEED)} therapists with PIN=0000")

    # Re-seed clients with full info
    cl_count = await db.clients.count_documents({})
    if cl_count != len(CLIENT_SEED):
        await db.clients.delete_many({})
        therapists_map = {t["name"]: t["id"] async for t in db.therapists.find({}, {"_id": 0, "name": 1, "id": 1})}
        for c in CLIENT_SEED:
            await db.clients.insert_one({
                "id": str(uuid.uuid4()),
                "file_no": c["file_no"], "name": c["name"],
                "package_hours": c["pkg"], "supervisor": c["sup"],
                "main_therapist_id": therapists_map.get(c["main"]),
                "co_therapist_ids": [therapists_map[n] for n in c["co"] if n in therapists_map],
                "color": c["color"], "locations": c["locs"],
                "parent_name": None, "parent_phone": None, "age": None,
                "notes": None, "created_at": now_iso(),
            })
        logger.info(f"Seeded {len(CLIENT_SEED)} clients with full info")

@app.on_event("shutdown")
async def shutdown():
    client.close()
