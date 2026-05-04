from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Any

import bcrypt
import jwt
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, UploadFile, File, Form
from fastapi.responses import FileResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

# ------------------- Setup -------------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

UPLOAD_DIR = ROOT_DIR / 'uploads'
UPLOAD_DIR.mkdir(exist_ok=True)

app = FastAPI(title="Boost Growth Portal API")
api = APIRouter(prefix="/api")

JWT_ALGORITHM = "HS256"
JWT_SECRET = os.environ["JWT_SECRET"]

# ------------------- Helpers -------------------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())

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
    pin: str  # 4-6 digits

class TherapistUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    color: Optional[str] = None
    pin: Optional[str] = None

class ScheduleCellIn(BaseModel):
    day: int  # 0-6 (Sat-Fri or Sun-Sat)
    time_slot: str  # "09:00"
    therapist_id: Optional[str] = None
    child_name: Optional[str] = None
    title: Optional[str] = None
    note: Optional[str] = None
    color: Optional[str] = "green"  # green, blue, yellow, red, custom
    custom_color: Optional[str] = None
    duration: Optional[int] = 1  # number of cells (rows)
    week_start: str  # ISO date of week start

class ClientIn(BaseModel):
    name: str
    age: Optional[str] = None
    parent_name: Optional[str] = None
    parent_phone: Optional[str] = None
    package: Optional[str] = None
    notes: Optional[str] = None
    therapist_id: Optional[str] = None

class RequestIn(BaseModel):
    title: str
    description: str
    request_type: Optional[str] = "general"  # general, leave, supplies, schedule
    priority: Optional[str] = "normal"  # low, normal, high, urgent

class RequestStatusUpdate(BaseModel):
    status: str  # pending, in_progress, approved, rejected, done
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
    intake_type: str = "pre"  # pre, post
    notes: Optional[str] = None
    status: Optional[str] = "new"

# ------------------- Auth -------------------
@api.post("/auth/login")
async def admin_login(payload: LoginIn, response: Response):
    email = payload.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="بيانات الدخول غير صحيحة")
    token = create_token({"sub": user["id"], "role": "admin", "email": email})
    set_auth_cookie(response, token)
    return {"id": user["id"], "email": email, "name": user.get("name"), "role": "admin", "token": token}

@api.get("/auth/therapists-list")
async def therapists_list_public():
    items = await db.therapists.find({}, {"_id": 0, "pin_hash": 0}).to_list(500)
    return items

@api.post("/auth/therapist-login")
async def therapist_login(payload: TherapistPinLogin, response: Response):
    t = await db.therapists.find_one({"id": payload.therapist_id})
    if not t or not verify_password(payload.pin, t["pin_hash"]):
        raise HTTPException(status_code=401, detail="الرقم السري غير صحيح")
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
    return await db.therapists.find({}, {"_id": 0, "pin_hash": 0}).to_list(500)

@api.post("/therapists")
async def create_therapist(payload: TherapistIn, _=Depends(admin_only)):
    tid = str(uuid.uuid4())
    doc = {
        "id": tid,
        "name": payload.name,
        "email": payload.email,
        "phone": payload.phone,
        "color": payload.color or "#7A8A6A",
        "pin_hash": hash_password(payload.pin),
        "created_at": now_iso(),
    }
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
    t = await db.therapists.find_one({"id": tid}, {"_id": 0, "pin_hash": 0})
    return t

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
    cells = await db.schedule_cells.find(q, {"_id": 0}).to_list(2000)
    # therapists see only cells assigned to them
    if user.get("role") == "therapist":
        cells = [c for c in cells if c.get("therapist_id") == user["id"]]
    return cells

@api.post("/schedule")
async def create_schedule_cell(payload: ScheduleCellIn, _=Depends(admin_only)):
    cid = str(uuid.uuid4())
    doc = {"id": cid, **payload.model_dump(), "created_at": now_iso()}
    await db.schedule_cells.insert_one(doc)
    doc.pop("_id", None)
    # Auto-notify therapist
    if doc.get("therapist_id"):
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": doc["therapist_id"],
            "type": "schedule",
            "title": "جلسة جديدة في الجدول",
            "message": f"تمت إضافة جلسة جديدة: {doc.get('child_name') or doc.get('title') or ''} - {doc.get('time_slot')}",
            "read": False,
            "created_at": now_iso(),
        })
    return doc

@api.put("/schedule/{cid}")
async def update_schedule_cell(cid: str, payload: ScheduleCellIn, _=Depends(admin_only)):
    update = payload.model_dump()
    await db.schedule_cells.update_one({"id": cid}, {"$set": update})
    cell = await db.schedule_cells.find_one({"id": cid}, {"_id": 0})
    if cell and cell.get("therapist_id"):
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": cell["therapist_id"],
            "type": "schedule",
            "title": "تحديث على الجدول",
            "message": f"تم تعديل جلسة: {cell.get('child_name') or ''} - {cell.get('time_slot')}",
            "read": False,
            "created_at": now_iso(),
        })
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
    msg = body.get("message") or f"تنبيه بخصوص جلسة {cell.get('child_name') or ''}"
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": cell["therapist_id"],
        "type": "schedule_alert",
        "title": "تنبيه من الإدارة",
        "message": msg,
        "read": False,
        "created_at": now_iso(),
    })
    return {"ok": True}

# ------------------- Clients & Sheets -------------------
@api.get("/clients")
async def list_clients(user=Depends(get_current_user)):
    q = {} if user.get("role") == "admin" else {"therapist_id": user["id"]}
    return await db.clients.find(q, {"_id": 0}).to_list(500)

@api.post("/clients")
async def create_client(payload: ClientIn, _=Depends(admin_only)):
    cid = str(uuid.uuid4())
    doc = {"id": cid, **payload.model_dump(), "created_at": now_iso()}
    await db.clients.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.put("/clients/{cid}")
async def update_client(cid: str, payload: ClientIn, _=Depends(admin_only)):
    await db.clients.update_one({"id": cid}, {"$set": payload.model_dump()})
    return await db.clients.find_one({"id": cid}, {"_id": 0})

@api.delete("/clients/{cid}")
async def delete_client(cid: str, _=Depends(admin_only)):
    await db.clients.delete_one({"id": cid})
    await db.attendance_sheets.delete_many({"client_id": cid})
    return {"ok": True}

@api.get("/clients/{cid}/sheets")
async def list_sheets(cid: str, user=Depends(get_current_user)):
    sheets = await db.attendance_sheets.find({"client_id": cid}, {"_id": 0}).sort("page_number", 1).to_list(500)
    return sheets

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
        content = await file.read()
        save_path.write_bytes(content)
        file_path = f"{sid}{ext}"
    last = await db.attendance_sheets.find_one({"client_id": cid}, sort=[("page_number", -1)])
    page_number = (last.get("page_number", 0) + 1) if last else 1
    doc = {
        "id": sid, "client_id": cid, "title": title, "session_date": session_date,
        "therapist_id": therapist_id, "notes": notes, "page_number": page_number,
        "file_name": file_name, "file_path": file_path,
        "created_at": now_iso(),
    }
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
    items = await db.requests.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items

@api.post("/requests")
async def create_request(payload: RequestIn, user=Depends(get_current_user)):
    if user.get("role") != "therapist":
        raise HTTPException(status_code=403, detail="Therapist only")
    rid = str(uuid.uuid4())
    doc = {
        "id": rid,
        "therapist_id": user["id"],
        "therapist_name": user.get("name"),
        "title": payload.title,
        "description": payload.description,
        "request_type": payload.request_type,
        "priority": payload.priority,
        "status": "pending",
        "admin_note": None,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.requests.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.put("/requests/{rid}/status")
async def update_request_status(rid: str, payload: RequestStatusUpdate, _=Depends(admin_only)):
    req = await db.requests.find_one({"id": rid})
    if not req:
        raise HTTPException(status_code=404, detail="Not found")
    await db.requests.update_one({"id": rid}, {"$set": {
        "status": payload.status,
        "admin_note": payload.admin_note,
        "updated_at": now_iso(),
    }})
    # Notify therapist
    status_map = {"pending": "قيد الانتظار", "in_progress": "قيد التنفيذ",
                  "approved": "تمت الموافقة", "rejected": "مرفوض", "done": "مكتمل"}
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": req["therapist_id"],
        "type": "request",
        "title": "تحديث على طلبك",
        "message": f"طلب '{req['title']}' أصبح: {status_map.get(payload.status, payload.status)}",
        "read": False,
        "created_at": now_iso(),
    })
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

# ------------------- Intake -------------------
@api.get("/intake")
async def list_intake(user=Depends(get_current_user)):
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

# ------------------- Health -------------------
@api.get("/")
async def root():
    return {"message": "Boost Growth Portal API", "status": "ok"}

# ------------------- Setup -------------------
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup():
    # Indexes
    await db.users.create_index("email", unique=True)
    await db.therapists.create_index("id", unique=True)
    await db.schedule_cells.create_index([("week_start", 1), ("day", 1), ("time_slot", 1)])
    await db.notifications.create_index("user_id")

    # Seed admin
    admin_email = os.environ["ADMIN_EMAIL"].lower()
    admin_password = os.environ["ADMIN_PASSWORD"]
    admin_name = os.environ.get("ADMIN_NAME", "Admin")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": admin_name,
            "role": "admin",
            "created_at": now_iso(),
        })
        logger.info(f"Admin seeded: {admin_email}")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})
        logger.info("Admin password updated")

    # Seed sample therapists if none
    count = await db.therapists.count_documents({})
    if count == 0:
        samples = [
            {"name": "أ. سارة العتيبي", "color": "#7A8A6A", "pin": "1234"},
            {"name": "أ. نورة الحربي", "color": "#D4A64A", "pin": "5678"},
            {"name": "أ. مريم الزهراني", "color": "#8FA481", "pin": "0000"},
        ]
        for s in samples:
            await db.therapists.insert_one({
                "id": str(uuid.uuid4()),
                "name": s["name"],
                "color": s["color"],
                "pin_hash": hash_password(s["pin"]),
                "email": None, "phone": None,
                "created_at": now_iso(),
            })
        logger.info("Sample therapists seeded")

@app.on_event("shutdown")
async def shutdown():
    client.close()
