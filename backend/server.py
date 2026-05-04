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
    color: Optional[str] = None
    duration: Optional[int] = 1  # number of time-slot rows the cell spans (1=single)
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

async def _notify_admins(ntype: str, title: str, message: str):
    """Send notification to all admin users."""
    admins = await db.users.find({"role": "admin"}, {"_id": 0, "id": 1}).to_list(50)
    for a in admins:
        await _notify(a["id"], ntype, title, message)

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
            await _notify_admins("cancel_alert", "Therapist cancellation",
                                 f"{cell.get('child_name') or '—'} session on day {cell.get('day')} at {cell.get('time_slot')} marked Therapist Cancel")
        elif cell.get("state") == "cancel_child":
            title = "Session marked as Client Cancellation"
            await _notify_admins("cancel_alert", "Client cancellation",
                                 f"{cell.get('child_name') or '—'} session on day {cell.get('day')} at {cell.get('time_slot')} marked Client Cancel")
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
    # Admin alerts
    client = await db.clients.find_one({"id": payload.client_id}, {"_id": 0})
    cname = client.get("name") if client else "—"
    if user.get("role") == "therapist":
        await _notify_admins("session_log", f"New session logged ({payload.status})",
                             f"{user.get('name')} logged {payload.status} for {cname} ({payload.hours}h)")
    if payload.status in ("Cancelled", "No Show"):
        await _notify_admins("cancel_alert", f"Session {payload.status}: {cname}",
                             f"On {payload.session_date} ({user.get('name')})")
    # Low-hours alert
    if client:
        used = await db.sessions.aggregate([
            {"$match": {"client_id": payload.client_id, "status": "Completed"}},
            {"$group": {"_id": None, "total": {"$sum": "$hours"}}}
        ]).to_list(1)
        used_h = used[0]["total"] if used else 0
        rem = (client.get("package_hours") or 24) - used_h
        if 0 < rem <= 4:
            await _notify_admins("low_hours", f"⚠️ {cname} has only {rem}h left",
                                 f"Pkg {client.get('package_hours')}h, used {used_h}h. Consider package renewal.")
        elif rem <= 0:
            await _notify_admins("low_hours", f"🔴 {cname} package exhausted",
                                 f"Used {used_h}h of {client.get('package_hours')}h.")
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
    # Notify admins of new request
    await _notify_admins("request_new", f"New {payload.request_type} request",
                         f"{user.get('name')}: {payload.title} (priority: {payload.priority})")
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

# ------------------- Reports -------------------
@api.get("/reports/dashboard")
async def reports_dashboard(_=Depends(admin_only)):
    sessions = await db.sessions.find({}, {"_id": 0}).to_list(5000)
    clients = await db.clients.find({}, {"_id": 0}).to_list(500)
    therapists = await db.therapists.find({}, {"_id": 0, "pin_hash": 0}).to_list(50)
    requests = await db.requests.find({}, {"_id": 0}).to_list(500)
    cells = await db.schedule_cells.find({}, {"_id": 0}).to_list(5000)

    # Sessions per therapist
    per_t: dict = {}
    for t in therapists:
        per_t[t["id"]] = {"name": t["name"], "color": t.get("color"),
                           "completed": 0, "cancelled": 0, "no_show": 0, "no_service": 0,
                           "hours": 0.0}
    for s in sessions:
        for tid in s.get("therapist_ids") or []:
            if tid in per_t:
                if s["status"] == "Completed":
                    per_t[tid]["completed"] += 1
                    per_t[tid]["hours"] += float(s.get("hours") or 0)
                elif s["status"] == "Cancelled":
                    per_t[tid]["cancelled"] += 1
                elif s["status"] == "No Show":
                    per_t[tid]["no_show"] += 1
                else:
                    per_t[tid]["no_service"] += 1

    # Per-client used hours + status
    per_c = []
    for c in clients:
        used = sum(float(s.get("hours") or 0) for s in sessions if s.get("client_id") == c["id"] and s.get("status") == "Completed")
        pkg = c.get("package_hours") or 24
        rem = max(0, pkg - used)
        if rem <= 0 or rem <= 2 or rem / pkg <= 0.2:
            status = "urgent"
        elif rem / pkg <= 0.35 or rem <= 4:
            status = "warning"
        else:
            status = "ok"
        per_c.append({"id": c["id"], "name": c["name"], "file_no": c.get("file_no"),
                      "color": c.get("color"), "pkg": pkg, "used": round(used, 1),
                      "rem": round(rem, 1), "status": status})

    # Cancellation breakdown from schedule cells (this week)
    sched_cancel_t = sum(1 for c in cells if c.get("state") == "cancel_therapist")
    sched_cancel_c = sum(1 for c in cells if c.get("state") == "cancel_child")

    return {
        "totals": {
            "therapists": len(therapists),
            "clients": len(clients),
            "sessions": len(sessions),
            "completed_sessions": sum(1 for s in sessions if s.get("status") == "Completed"),
            "total_hours": round(sum(float(s.get("hours") or 0) for s in sessions if s.get("status") == "Completed"), 1),
            "open_requests": sum(1 for r in requests if r.get("status") == "pending"),
            "urgent_clients": sum(1 for c in per_c if c["status"] == "urgent"),
            "warning_clients": sum(1 for c in per_c if c["status"] == "warning"),
            "schedule_cells": len(cells),
            "schedule_cancel_therapist": sched_cancel_t,
            "schedule_cancel_child": sched_cancel_c,
        },
        "per_therapist": list(per_t.values()),
        "per_client": sorted(per_c, key=lambda x: {"urgent":0,"warning":1,"ok":2}[x["status"]]),
    }

# ------------------- Imports -------------------
def _read_table(file: UploadFile) -> List[dict]:
    """Read xlsx/csv into list of dicts with normalized lower-case keys."""
    import pandas as pd
    content = file.file.read()
    import io
    if file.filename.lower().endswith(".csv"):
        df = pd.read_csv(io.BytesIO(content))
    else:
        df = pd.read_excel(io.BytesIO(content), engine="openpyxl")
    df.columns = [str(c).strip().lower() for c in df.columns]
    df = df.where(df.notna(), None)
    return df.to_dict("records")

@api.post("/import/clients")
async def import_clients(file: UploadFile = File(...), _=Depends(admin_only)):
    rows = _read_table(file)
    created, skipped = 0, 0
    therapists = await db.therapists.find({}, {"_id": 0}).to_list(100)
    t_by_name = {t["name"].lower(): t["id"] for t in therapists}
    for r in rows:
        name = r.get("name") or r.get("child_name") or r.get("full_name")
        if not name:
            skipped += 1; continue
        file_no = str(r.get("file_no") or r.get("id") or r.get("file") or "").strip() or None
        # match therapist name to id
        main_name = (r.get("main_therapist") or r.get("main") or "").strip().lower() if r.get("main_therapist") or r.get("main") else None
        main_id = t_by_name.get(main_name) if main_name else None
        await db.clients.insert_one({
            "id": str(uuid.uuid4()), "name": str(name).strip(),
            "file_no": file_no, "package_hours": float(r.get("package_hours") or r.get("pkg") or 24),
            "supervisor": r.get("supervisor"), "main_therapist_id": main_id,
            "co_therapist_ids": [], "color": r.get("color") or "#A2C4C9",
            "locations": [], "parent_name": r.get("parent_name") or r.get("parent"),
            "parent_phone": str(r.get("parent_phone") or r.get("phone") or "") or None,
            "age": str(r.get("age") or "") or None, "notes": r.get("notes"),
            "created_at": now_iso(),
        })
        created += 1
    return {"created": created, "skipped": skipped}

@api.post("/import/intake")
async def import_intake(file: UploadFile = File(...), _=Depends(admin_only)):
    rows = _read_table(file)
    created, skipped = 0, 0
    for r in rows:
        name = r.get("child_name") or r.get("name")
        if not name:
            skipped += 1; continue
        intake_type = (r.get("intake_type") or r.get("type") or "pre").lower()
        if intake_type not in ("pre", "post"):
            intake_type = "pre"
        await db.intake.insert_one({
            "id": str(uuid.uuid4()), "child_name": str(name).strip(),
            "parent_name": r.get("parent_name") or r.get("parent"),
            "phone": str(r.get("phone") or "") or None,
            "intake_type": intake_type, "status": (r.get("status") or "new").lower(),
            "notes": r.get("notes"), "intake_date": str(r.get("intake_date") or "") or None,
            "age": str(r.get("age") or "") or None, "created_at": now_iso(),
        })
        created += 1
    return {"created": created, "skipped": skipped}

# ------------------- Historical Schedule Loader -------------------
HISTORICAL_SCHEDULES = None  # lazy-loaded from JSON file

def _load_historical():
    global HISTORICAL_SCHEDULES
    if HISTORICAL_SCHEDULES is None:
        import json
        path = ROOT_DIR / "historical_schedules.json"
        if path.exists():
            HISTORICAL_SCHEDULES = json.loads(path.read_text())
        else:
            HISTORICAL_SCHEDULES = {}
    return HISTORICAL_SCHEDULES

@api.get("/import/historical-weeks")
async def list_historical_weeks(_=Depends(admin_only)):
    data = _load_historical()
    return {"weeks": list(data.keys())}

@api.post("/import/historical-load")
async def import_historical(body: dict, _=Depends(admin_only)):
    """Import all historical weeks into schedule_cells. body: {clear_existing?: bool}"""
    data = _load_historical()
    if not data:
        raise HTTPException(status_code=404, detail="No historical data file found")
    if body.get("clear_existing"):
        await db.schedule_cells.delete_many({})
    therapists = await db.therapists.find({}, {"_id": 0}).to_list(100)
    t_by_name = {t["name"]: t["id"] for t in therapists}
    DAYS_MAP = {"Sunday":0, "Monday":1, "Tuesday":2, "Wednesday":3, "Thursday":4}
    TIMES = ["8:00 AM - 9:00 AM","9:00 AM - 10:00 AM","10:00 AM - 11:00 AM",
             "11:00 AM - 12:00 PM","12:00 PM - 1:00 PM","1:00 PM - 2:00 PM",
             "2:00 PM - 3:00 PM","3:00 PM - 4:00 PM","4:00 PM - 5:00 PM",
             "5:00 PM - 6:00 PM"]
    inserted = 0
    weeks_loaded = 0
    for week_label, therapists_data in data.items():
        # parse week label like "26 Apr- 30 Apr" → use a fake ISO date for storage
        week_start_iso = f"hist:{week_label}"
        weeks_loaded += 1
        for entry in therapists_data:
            tname = entry.get("n")
            t_id = t_by_name.get(tname)
            if not t_id:
                continue
            for day_label, slots in entry.get("s", []):
                day_idx = DAYS_MAP.get(day_label)
                if day_idx is None:
                    continue
                for slot_idx, raw in enumerate(slots):
                    if not raw or not str(raw).strip():
                        continue
                    txt = str(raw).strip()
                    # parse service code
                    service = "SS"
                    child = None
                    note = None
                    custom = None
                    upper = txt.upper()
                    if upper.startswith("HS"): service = "HS"
                    elif upper.startswith("SS"): service = "SS"
                    elif upper.startswith("OS"): service = "OS"
                    elif "AVC" in upper: service = "AVC"
                    elif "SUPERVISION" in upper: service = "SUPERVISION"
                    elif "OBSERVATION" in upper: service = "OBSERVATION"
                    elif "MEETING" in upper: service = "MEETING"
                    elif "LEAVE" in upper: service = "LEAVE"
                    elif "BREAK" in upper: service = "BREAK"
                    # extract child name after | or W/
                    if "|" in txt:
                        child = txt.split("|", 1)[1].strip()
                    elif "W/" in txt:
                        child = txt.split("W/", 1)[1].strip()
                    elif "with" in txt.lower():
                        child = txt.lower().split("with", 1)[1].strip()
                    if child and "(" in child:
                        custom = child[child.find("(")+1:child.find(")")]
                        child = child[:child.find("(")].strip()
                    if slot_idx >= len(TIMES):
                        continue
                    if service in ("LEAVE", "BREAK", "AVC"):
                        note = txt
                    await db.schedule_cells.insert_one({
                        "id": str(uuid.uuid4()),
                        "therapist_id": t_id, "day": day_idx,
                        "time_slot": TIMES[slot_idx],
                        "service_code": service, "child_name": child,
                        "note": note, "custom_time": custom,
                        "state": "normal", "color": None, "duration": 1,
                        "week_start": week_start_iso, "created_at": now_iso(),
                    })
                    inserted += 1
    return {"weeks_loaded": weeks_loaded, "cells_inserted": inserted}

@api.post("/schedule/duplicate-week")
async def duplicate_week(body: dict, _=Depends(admin_only)):
    """Copy all cells from source_week to target_week. body: {source_week, target_week, clear_target?}"""
    source = body.get("source_week"); target = body.get("target_week")
    if not source or not target:
        raise HTTPException(status_code=400, detail="source_week and target_week required")
    if body.get("clear_target"):
        await db.schedule_cells.delete_many({"week_start": target})
    cells = await db.schedule_cells.find({"week_start": source}, {"_id": 0}).to_list(5000)
    inserted = 0
    for c in cells:
        new_c = {**c, "id": str(uuid.uuid4()), "week_start": target,
                 "state": "normal", "created_at": now_iso()}
        await db.schedule_cells.insert_one(new_c)
        inserted += 1
    return {"copied": inserted}

@api.post("/import/schedule-excel")
async def import_schedule_excel(file: UploadFile = File(...),
                                 week_start: str = Form(...),
                                 clear_existing: Optional[str] = Form(None),
                                 _=Depends(admin_only)):
    """Parse a Therapists' Schedule .xlsx file and create cells for the given week_start.
    Expected layout: each sheet/section has a therapist name with rows for Sunday→Thursday
    and 10 time-slot columns. Cell text format: 'SS | Child', 'HS | Child', 'Meeting w/ X', 'AVC', 'Leave', etc.
    """
    import openpyxl, io
    content = await file.read()
    wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
    therapists = await db.therapists.find({}, {"_id": 0, "pin_hash": 0}).to_list(100)
    t_by_name = {t["name"]: t["id"] for t in therapists}
    # Also accept short names
    for t in therapists:
        short = t["name"].replace("Ms. ", "").strip()
        t_by_name[short] = t["id"]
        t_by_name[short.lower()] = t["id"]

    DAYS_MAP = {"sunday": 0, "monday": 1, "tuesday": 2, "wednesday": 3, "thursday": 4}
    TIMES = ["8:00 AM - 9:00 AM","9:00 AM - 10:00 AM","10:00 AM - 11:00 AM",
             "11:00 AM - 12:00 PM","12:00 PM - 1:00 PM","1:00 PM - 2:00 PM",
             "2:00 PM - 3:00 PM","3:00 PM - 4:00 PM","4:00 PM - 5:00 PM",
             "5:00 PM - 6:00 PM"]

    if clear_existing == "true":
        await db.schedule_cells.delete_many({"week_start": week_start})

    inserted = 0
    skipped_unknown_therapist = []

    def parse_cell(txt: str):
        """Returns (service_code, child_name, custom_time, note) for a cell text."""
        if not txt or not str(txt).strip():
            return None
        txt = str(txt).strip()
        upper = txt.upper()
        custom = None
        note = None
        child = None
        service = "SS"
        if "AVC" in upper: service = "AVC"; note = txt
        elif "LEAVE" in upper: service = "LEAVE"; note = txt
        elif "BREAK" in upper: service = "BREAK"; note = txt
        elif "SUPERVISION" in upper: service = "SUPERVISION"
        elif "OBSERVATION" in upper: service = "OBSERVATION"
        elif "MEETING" in upper: service = "MEETING"
        elif upper.startswith("HS"): service = "HS"
        elif upper.startswith("OS"): service = "OS"
        elif upper.startswith("SS"): service = "SS"
        # Extract child after | or W/ or with
        if "|" in txt:
            child = txt.split("|", 1)[1].strip()
        elif "W/" in upper:
            idx = upper.index("W/")
            child = txt[idx+2:].strip()
        elif " with " in txt.lower():
            child = txt.lower().split(" with ", 1)[1].strip().title()
        # Extract custom time inside ( )
        if child and "(" in child:
            m_open = child.find("(")
            m_close = child.find(")", m_open)
            if m_close > m_open:
                custom = child[m_open+1:m_close].strip()
                child = child[:m_open].strip()
        return service, child, custom, note

    # Iterate all sheets
    for ws in wb.worksheets:
        rows = list(ws.iter_rows(values_only=True))
        i = 0
        while i < len(rows):
            row = rows[i] or ()
            cells = [str(c).strip() if c is not None else "" for c in row]
            # Detect header row: contains "Therapist's Name" and "Days"
            joined = " ".join(c.lower() for c in cells)
            if "therapist" in joined and "days" in joined and "8:00" in joined:
                # The next 5 rows should be: therapist_name | day | 10 slots
                current_t_id = None
                for k in range(1, 6):
                    if i + k >= len(rows):
                        break
                    sub = rows[i + k] or ()
                    sub_cells = [str(c).strip() if c is not None else "" for c in sub]
                    if len(sub_cells) < 4:
                        continue
                    # Therapist name typically in col B (idx 1) on first sub-row
                    name_candidate = sub_cells[1] if len(sub_cells) > 1 else ""
                    if name_candidate and current_t_id is None:
                        if name_candidate in t_by_name:
                            current_t_id = t_by_name[name_candidate]
                        else:
                            for key, tid in t_by_name.items():
                                if key.lower() == name_candidate.lower():
                                    current_t_id = tid; break
                    if current_t_id is None:
                        # Skip if can't find therapist; but track for skipped
                        if name_candidate and name_candidate not in skipped_unknown_therapist:
                            skipped_unknown_therapist.append(name_candidate)
                        continue
                    # Day in col C (idx 2)
                    day_label = sub_cells[2].lower() if len(sub_cells) > 2 else ""
                    day_idx = DAYS_MAP.get(day_label)
                    if day_idx is None:
                        continue
                    # Time slots in cols D-M (idx 3-12)
                    for slot_idx in range(10):
                        col_idx = 3 + slot_idx
                        if col_idx >= len(sub_cells):
                            break
                        val = sub_cells[col_idx]
                        parsed = parse_cell(val)
                        if not parsed:
                            continue
                        service, child, custom, note = parsed
                        await db.schedule_cells.insert_one({
                            "id": str(uuid.uuid4()),
                            "therapist_id": current_t_id,
                            "day": day_idx, "time_slot": TIMES[slot_idx],
                            "service_code": service, "child_name": child,
                            "note": note, "custom_time": custom,
                            "state": "normal", "color": None, "duration": 1,
                            "week_start": week_start, "created_at": now_iso(),
                        })
                        inserted += 1
                i += 6  # skip past header + 5 data rows
                continue
            i += 1

    return {"cells_inserted": inserted, "week_start": week_start, "skipped_therapists": skipped_unknown_therapist[:20]}

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
    {"name": "Ms. Najla", "color": "#7BA890", "email": "najla@boostgrowthsa.com"},
    {"name": "Ms. Walaa", "color": "#C28E6A", "email": "walaa@boostgrowthsa.com"},
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
