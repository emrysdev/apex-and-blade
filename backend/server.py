from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import logging
import uuid
import asyncio
import secrets
from datetime import datetime, timezone, timedelta

import bcrypt
import jwt
import resend
from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, Depends, Query
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr
from typing import List, Optional

from fastapi import (
    FastAPI,
    APIRouter,
    Request,
    Response,
    HTTPException,
    Depends,
    Query,
    UploadFile,
    File,
    Form,
)

from starlette.staticfiles import StaticFiles

app = FastAPI()

UPLOAD_DIR = ROOT_DIR / "uploads"
GALLERY_UPLOAD_DIR = UPLOAD_DIR / "gallery"

GALLERY_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

app.mount(
    "/uploads",
    StaticFiles(directory=str(UPLOAD_DIR)),
    name="uploads"
)


# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_ALGORITHM = "HS256"
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN", "")
TWILIO_FROM_NUMBER = os.environ.get("TWILIO_FROM_NUMBER", "")
OWNER_PHONE = os.environ.get("OWNER_PHONE", "")
# Trial accounts can only send predefined templates; used as automatic fallback.
TWILIO_TRIAL_TEMPLATE = os.environ.get("TWILIO_TRIAL_TEMPLATE", "sms_appointment_reminders")
_twilio_client = None
if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
    from twilio.rest import Client as TwilioClient
    _twilio_client = TwilioClient(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("apexblade")

app = FastAPI()
api = APIRouter(prefix="/api")


def now_utc():
    return datetime.now(timezone.utc)


def new_id():
    return str(uuid.uuid4())


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {"sub": user_id, "email": email, "role": role,
               "exp": now_utc() + timedelta(days=7), "type": "access"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def set_auth_cookie(response: Response, token: str):
    response.set_cookie(key="access_token", value=token, httponly=True,
                        secure=True, samesite="none", max_age=604800, path="/")


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


async def optional_user(request: Request) -> Optional[dict]:
    try:
        return await get_current_user(request)
    except HTTPException:
        return None


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class RegisterInput(BaseModel):
    name: str
    email: EmailStr
    password: str
    phone: Optional[str] = ""


class LoginInput(BaseModel):
    email: EmailStr
    password: str


class ServiceInput(BaseModel):
    name: str
    description: str = ""
    price: float
    duration: int
    category: str = "Haircut"
    active: bool = True
    featured: bool = False
    image: str = ""


class AddonInput(BaseModel):
    name: str
    description: str = ""
    price: float
    duration: int = 0
    active: bool = True


class HairstyleInput(BaseModel):
    title: str
    tag: str = ""
    image: str
    active: bool = True


class GalleryInput(BaseModel):
    title: str = ""
    category: str = "General"
    image: str
    active: bool = True


class BlackoutInput(BaseModel):
    date: str
    reason: str = ""


class SettingsInput(BaseModel):
    shop_name: Optional[str] = None
    tagline: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    instagram: Optional[str] = None
    about: Optional[str] = None
    timezone: Optional[str] = None
    slot_interval: Optional[int] = None
    auto_confirm: Optional[bool] = None
    deposit_enabled: Optional[bool] = None
    hours: Optional[dict] = None


class BookingInput(BaseModel):
    service_id: str
    addon_ids: List[str] = []
    hairstyle_id: Optional[str] = None
    notes: str = ""
    date: str
    start_time: str
    customer_name: str
    customer_email: EmailStr
    customer_phone: str = ""


class StatusUpdate(BaseModel):
    status: str


# ---------------------------------------------------------------------------
# Email
# ---------------------------------------------------------------------------
async def send_email(to_email: str, subject: str, html: str):
    if not RESEND_API_KEY:
        logger.info(f"[EMAIL MOCK] To: {to_email} | Subject: {subject}")
        return {"status": "mock"}
    try:
        params = {"from": SENDER_EMAIL, "to": [to_email], "subject": subject, "html": html}
        res = await asyncio.to_thread(resend.Emails.send, params)
        return {"status": "sent", "id": res.get("id")}
    except Exception as e:
        logger.error(f"Email send failed: {e}")
        return {"status": "error", "error": str(e)}


async def send_sms(to_number: str, body: str):
    if not _twilio_client or not TWILIO_FROM_NUMBER or not to_number:
        logger.info(f"[SMS MOCK] To: {to_number} | {body}")
        return {"status": "mock"}

    def _send(msg_body):
        return _twilio_client.messages.create(body=msg_body, from_=TWILIO_FROM_NUMBER, to=to_number)

    try:
        msg = await asyncio.to_thread(_send, body)
        logger.info(f"SMS sent to {to_number} sid={msg.sid}")
        return {"status": "sent", "sid": msg.sid}
    except Exception as e:
        # Twilio trial accounts (error 572006) only allow predefined templates.
        if "572006" in str(e) or "predefined" in str(e).lower():
            try:
                msg = await asyncio.to_thread(_send, TWILIO_TRIAL_TEMPLATE)
                logger.warning(
                    f"SMS custom body blocked by Twilio trial; sent template "
                    f"'{TWILIO_TRIAL_TEMPLATE}' to {to_number} sid={msg.sid}. "
                    f"Upgrade Twilio account to send full booking details."
                )
                return {"status": "sent_template", "sid": msg.sid}
            except Exception as e2:
                logger.error(f"SMS template fallback failed: {e2}")
                return {"status": "error", "error": str(e2)}
        logger.error(f"SMS send failed: {e}")
        return {"status": "error", "error": str(e)}


def owner_sms_body(booking: dict) -> str:
    addons = ", ".join(a["name"] for a in booking.get("addons", []))
    lines = [
        f"New booking {booking['reference']} ({booking['status']})",
        f"{booking['service_name']}" + (f" + {addons}" if addons else ""),
        f"{booking['date']} {booking['start_time']}-{booking['end_time']}",
        f"{booking['customer_name']} {booking.get('customer_phone') or booking.get('customer_email','')}",
        f"Total ${booking['total_price']:.2f} (pay at shop)",
    ]
    return "\n".join(lines)


def booking_email_html(booking: dict, service_name: str) -> str:
    status = booking["status"].capitalize()
    return f"""
    <div style="font-family:Arial,sans-serif;background:#0D0D0E;color:#F4F1EA;padding:32px;">
      <div style="max-width:520px;margin:auto;background:#141416;border:1px solid #D4AF37;border-radius:12px;padding:32px;">
        <h1 style="color:#D4AF37;font-size:24px;margin:0 0 8px;">Apex &amp; Blade</h1>
        <p style="color:#A1A1AA;margin:0 0 24px;">Booking {status}</p>
        <table style="width:100%;color:#F4F1EA;font-size:15px;">
          <tr><td style="padding:6px 0;color:#A1A1AA;">Reference</td><td style="text-align:right;font-weight:bold;">{booking['reference']}</td></tr>
          <tr><td style="padding:6px 0;color:#A1A1AA;">Service</td><td style="text-align:right;">{service_name}</td></tr>
          <tr><td style="padding:6px 0;color:#A1A1AA;">Date</td><td style="text-align:right;">{booking['date']}</td></tr>
          <tr><td style="padding:6px 0;color:#A1A1AA;">Time</td><td style="text-align:right;">{booking['start_time']} - {booking['end_time']}</td></tr>
          <tr><td style="padding:6px 0;color:#A1A1AA;">Total</td><td style="text-align:right;color:#D4AF37;font-weight:bold;">${booking['total_price']:.2f}</td></tr>
        </table>
        <p style="color:#A1A1AA;font-size:13px;margin-top:24px;">Payment: Pay at the shop. See you soon!</p>
      </div>
    </div>
    """


# ---------------------------------------------------------------------------
# Availability logic
# ---------------------------------------------------------------------------
WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


def to_minutes(hhmm: str) -> int:
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


def to_hhmm(minutes: int) -> str:
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


async def get_settings_doc() -> dict:
    s = await db.settings.find_one({"id": "shop"}, {"_id": 0})
    return s or {}


async def compute_slots(target_date: str, duration: int) -> List[str]:
    settings = await get_settings_doc()
    interval = settings.get("slot_interval", 30)
    hours = settings.get("hours", {})

    try:
        d = datetime.strptime(target_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")

    if await db.blackouts.find_one({"date": target_date}):
        return []

    weekday = WEEKDAYS[d.weekday()]
    day_cfg = hours.get(weekday, {})
    if not day_cfg or day_cfg.get("closed"):
        return []

    open_m = to_minutes(day_cfg["open"])
    close_m = to_minutes(day_cfg["close"])

    existing = await db.bookings.find(
        {"date": target_date, "status": {"$in": ["pending", "confirmed"]}},
        {"_id": 0, "start_min": 1, "end_min": 1}
    ).to_list(500)
    busy = [(b["start_min"], b["end_min"]) for b in existing]

    now_min = None
    tz_now = now_utc()
    if d == tz_now.date():
        now_min = tz_now.hour * 60 + tz_now.minute

    slots = []
    t = open_m
    while t + duration <= close_m:
        end = t + duration
        if now_min is not None and t <= now_min:
            t += interval
            continue
        conflict = any(t < be and end > bs for bs, be in busy)
        if not conflict:
            slots.append(to_hhmm(t))
        t += interval
    return slots


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------
@api.post("/auth/register")
async def register(body: RegisterInput, response: Response):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    user = {
        "id": new_id(), "name": body.name, "email": email, "phone": body.phone,
        "password_hash": hash_password(body.password), "role": "customer",
        "created_at": now_utc().isoformat(),
    }
    await db.users.insert_one(user)
    token = create_access_token(user["id"], email, "customer")
    set_auth_cookie(response, token)
    return {"id": user["id"], "name": user["name"], "email": email, "phone": body.phone, "role": "customer"}


@api.post("/auth/login")
async def login(body: LoginInput, response: Response):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user["id"], email, user["role"])
    set_auth_cookie(response, token)
    return {"id": user["id"], "name": user["name"], "email": email,
            "phone": user.get("phone", ""), "role": user["role"]}


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"message": "Logged out"}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


# ---------------------------------------------------------------------------
# Public content routes
# ---------------------------------------------------------------------------
@api.get("/services")
async def list_services(all: bool = False):
    q = {} if all else {"active": True}
    items = await db.services.find(q, {"_id": 0}).to_list(200)
    items.sort(key=lambda x: (not x.get("featured", False), x.get("name", "")))
    return items


@api.get("/addons")
async def list_addons(all: bool = False):
    q = {} if all else {"active": True}
    return await db.addons.find(q, {"_id": 0}).to_list(200)


@api.get("/hairstyles")
async def list_hairstyles(all: bool = False):
    q = {} if all else {"active": True}
    return await db.hairstyles.find(q, {"_id": 0}).to_list(200)


@api.get("/gallery")
async def list_gallery(all: bool = False):
    q = {} if all else {"active": True}
    return await db.gallery.find(q, {"_id": 0}).to_list(200)


@api.get("/settings")
async def get_settings():
    s = await get_settings_doc()
    s.pop("id", None)
    return s


@api.get("/blackouts")
async def list_blackouts():
    return await db.blackouts.find({}, {"_id": 0}).to_list(500)


@api.get("/availability")
async def availability(date: str = Query(...), service_id: str = Query(...)):
    service = await db.services.find_one({"id": service_id}, {"_id": 0})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    slots = await compute_slots(date, service["duration"])
    return {"date": date, "slots": slots}


# ---------------------------------------------------------------------------
# Bookings
# ---------------------------------------------------------------------------
def gen_reference() -> str:
    return "AB-" + secrets.token_hex(3).upper()


@api.post("/bookings")
async def create_booking(body: BookingInput, request: Request):
    service = await db.services.find_one({"id": body.service_id}, {"_id": 0})
    if not service or not service.get("active", True):
        raise HTTPException(status_code=404, detail="Service not available")

    addons = []
    if body.addon_ids:
        addons = await db.addons.find({"id": {"$in": body.addon_ids}}, {"_id": 0}).to_list(50)

    duration = service["duration"] + sum(a.get("duration", 0) for a in addons)
    total_price = service["price"] + sum(a.get("price", 0) for a in addons)

    start_min = to_minutes(body.start_time)
    end_min = start_min + duration

    slots = await compute_slots(body.date, service["duration"])
    if body.start_time not in slots:
        raise HTTPException(status_code=409, detail="Selected time slot is no longer available")

    conflict = await db.bookings.find_one({
        "date": body.date,
        "status": {"$in": ["pending", "confirmed"]},
        "start_min": {"$lt": end_min},
        "end_min": {"$gt": start_min},
    })
    if conflict:
        raise HTTPException(status_code=409, detail="Selected time slot was just booked")

    settings = await get_settings_doc()
    auto_confirm = settings.get("auto_confirm", True)
    status = "confirmed" if auto_confirm else "pending"

    hairstyle = None
    if body.hairstyle_id:
        hs = await db.hairstyles.find_one({"id": body.hairstyle_id}, {"_id": 0})
        if hs:
            hairstyle = hs["title"]

    current = await optional_user(request)

    booking = {
        "id": new_id(),
        "reference": gen_reference(),
        "service_id": service["id"],
        "service_name": service["name"],
        "addons": [{"name": a["name"], "price": a["price"]} for a in addons],
        "hairstyle": hairstyle,
        "notes": body.notes,
        "date": body.date,
        "start_time": body.start_time,
        "end_time": to_hhmm(end_min),
        "start_min": start_min,
        "end_min": end_min,
        "duration": duration,
        "total_price": round(total_price, 2),
        "status": status,
        "payment_method": "pay_at_shop",
        "payment_status": "unpaid",
        "customer_name": body.customer_name,
        "customer_email": body.customer_email.lower(),
        "customer_phone": body.customer_phone,
        "user_id": current["id"] if current else None,
        "source": "online",
        "created_at": now_utc().isoformat(),
    }
    await db.bookings.insert_one(booking)

    html = booking_email_html(booking, service["name"])
    await send_email(booking["customer_email"], f"Booking {status.capitalize()} - {booking['reference']}", html)

    # Notify shop owner via SMS (online bookings only)
    if OWNER_PHONE:
        await send_sms(OWNER_PHONE, owner_sms_body(booking))

    booking.pop("_id", None)
    return booking


@api.get("/bookings/reference/{reference}")
async def get_booking_by_ref(reference: str):
    b = await db.bookings.find_one({"reference": reference}, {"_id": 0})
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    return b


@api.get("/bookings/me")
async def my_bookings(user: dict = Depends(get_current_user)):
    items = await db.bookings.find({"user_id": user["id"]}, {"_id": 0}).to_list(200)
    items.sort(key=lambda x: (x["date"], x["start_time"]), reverse=True)
    return items


@api.post("/bookings/{booking_id}/cancel")
async def cancel_my_booking(booking_id: str, user: dict = Depends(get_current_user)):
    b = await db.bookings.find_one({"id": booking_id})
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    if b.get("user_id") != user["id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not allowed")
    await db.bookings.update_one({"id": booking_id}, {"$set": {"status": "cancelled"}})
    return {"message": "Booking cancelled"}


# ---------------------------------------------------------------------------
# Admin routes
# ---------------------------------------------------------------------------
@api.get("/admin/stats")
async def admin_stats(admin: dict = Depends(require_admin)):
    today = now_utc().date().isoformat()
    all_bookings = await db.bookings.find({}, {"_id": 0}).to_list(2000)
    today_bookings = [b for b in all_bookings if b["date"] == today]
    active = [b for b in all_bookings if b["status"] in ("pending", "confirmed", "completed")]
    revenue = sum(b["total_price"] for b in active)
    service_counts = {}
    for b in active:
        service_counts[b["service_name"]] = service_counts.get(b["service_name"], 0) + 1
    top = sorted(service_counts.items(), key=lambda x: -x[1])[:5]
    day_counts = {}
    for b in active:
        wd = WEEKDAYS[datetime.strptime(b["date"], "%Y-%m-%d").weekday()]
        day_counts[wd] = day_counts.get(wd, 0) + 1
    return {
        "today_count": len(today_bookings),
        "total_bookings": len(all_bookings),
        "pending_count": len([b for b in all_bookings if b["status"] == "pending"]),
        "revenue": round(revenue, 2),
        "top_services": [{"name": n, "count": c} for n, c in top],
        "busy_days": [{"day": d, "count": c} for d, c in sorted(day_counts.items(), key=lambda x: -x[1])],
    }


@api.get("/admin/bookings")
async def admin_bookings(status: Optional[str] = None, admin: dict = Depends(require_admin)):
    q = {}
    if status and status != "all":
        q["status"] = status
    items = await db.bookings.find(q, {"_id": 0}).to_list(2000)
    items.sort(key=lambda x: (x["date"], x["start_time"]), reverse=True)
    return items


@api.post("/admin/bookings")
async def admin_create_booking(body: BookingInput, admin: dict = Depends(require_admin)):
    service = await db.services.find_one({"id": body.service_id}, {"_id": 0})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    addons = await db.addons.find({"id": {"$in": body.addon_ids}}, {"_id": 0}).to_list(50) if body.addon_ids else []
    duration = service["duration"] + sum(a.get("duration", 0) for a in addons)
    total_price = service["price"] + sum(a.get("price", 0) for a in addons)
    start_min = to_minutes(body.start_time)
    end_min = start_min + duration
    booking = {
        "id": new_id(), "reference": gen_reference(),
        "service_id": service["id"], "service_name": service["name"],
        "addons": [{"name": a["name"], "price": a["price"]} for a in addons],
        "hairstyle": None, "notes": body.notes, "date": body.date,
        "start_time": body.start_time, "end_time": to_hhmm(end_min),
        "start_min": start_min, "end_min": end_min, "duration": duration,
        "total_price": round(total_price, 2), "status": "confirmed",
        "payment_method": "pay_at_shop", "payment_status": "unpaid",
        "customer_name": body.customer_name, "customer_email": body.customer_email.lower(),
        "customer_phone": body.customer_phone, "user_id": None, "source": "manual",
        "created_at": now_utc().isoformat(),
    }
    await db.bookings.insert_one(booking)
    booking.pop("_id", None)
    return booking


@api.patch("/admin/bookings/{booking_id}")
async def admin_update_booking(booking_id: str, body: StatusUpdate, admin: dict = Depends(require_admin)):
    valid = ["pending", "confirmed", "cancelled", "completed", "no-show"]
    if body.status not in valid:
        raise HTTPException(status_code=400, detail="Invalid status")
    b = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    await db.bookings.update_one({"id": booking_id}, {"$set": {"status": body.status}})
    if body.status in ("confirmed", "cancelled"):
        html = booking_email_html({**b, "status": body.status}, b["service_name"])
        await send_email(b["customer_email"], f"Booking {body.status.capitalize()} - {b['reference']}", html)
    return {"message": "Updated"}


# --- Services CRUD ---
@api.post("/admin/services")
async def create_service(body: ServiceInput, admin: dict = Depends(require_admin)):
    doc = {"id": new_id(), **body.model_dump()}
    await db.services.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.put("/admin/services/{sid}")
async def update_service(sid: str, body: ServiceInput, admin: dict = Depends(require_admin)):
    await db.services.update_one({"id": sid}, {"$set": body.model_dump()})
    return await db.services.find_one({"id": sid}, {"_id": 0})


@api.delete("/admin/services/{sid}")
async def delete_service(sid: str, admin: dict = Depends(require_admin)):
    await db.services.delete_one({"id": sid})
    return {"message": "Deleted"}


# --- Addons CRUD ---
@api.post("/admin/addons")
async def create_addon(body: AddonInput, admin: dict = Depends(require_admin)):
    doc = {"id": new_id(), **body.model_dump()}
    await db.addons.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.put("/admin/addons/{aid}")
async def update_addon(aid: str, body: AddonInput, admin: dict = Depends(require_admin)):
    await db.addons.update_one({"id": aid}, {"$set": body.model_dump()})
    return await db.addons.find_one({"id": aid}, {"_id": 0})


@api.delete("/admin/addons/{aid}")
async def delete_addon(aid: str, admin: dict = Depends(require_admin)):
    await db.addons.delete_one({"id": aid})
    return {"message": "Deleted"}


# --- Hairstyles CRUD ---
@api.post("/admin/hairstyles")
async def create_hairstyle(body: HairstyleInput, admin: dict = Depends(require_admin)):
    doc = {"id": new_id(), **body.model_dump()}
    await db.hairstyles.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.put("/admin/hairstyles/{hid}")
async def update_hairstyle(hid: str, body: HairstyleInput, admin: dict = Depends(require_admin)):
    await db.hairstyles.update_one({"id": hid}, {"$set": body.model_dump()})
    return await db.hairstyles.find_one({"id": hid}, {"_id": 0})


@api.delete("/admin/hairstyles/{hid}")
async def delete_hairstyle(hid: str, admin: dict = Depends(require_admin)):
    await db.hairstyles.delete_one({"id": hid})
    return {"message": "Deleted"}


# --- Gallery CRUD ---
@api.post("/admin/gallery")
async def create_gallery(body: GalleryInput, admin: dict = Depends(require_admin)):
    doc = {"id": new_id(), **body.model_dump()}
    await db.gallery.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.post("/admin/gallery/upload")
async def upload_gallery_photo(
    request: Request,
    photo: UploadFile = File(...),
    title: str = Form(""),
    category: str = Form("General"),
    admin: dict = Depends(require_admin),
):
    allowed_types = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp"
    }

    if photo.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Please upload a JPG, PNG or WEBP image"
        )

    contents = await photo.read()

    if not contents:
        raise HTTPException(
            status_code=400,
            detail="The selected image is empty"
        )

    # Maximum 8 MB
    if len(contents) > 8 * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail="Image must be 8 MB or smaller"
        )

    filename = (
        f"{uuid.uuid4().hex}"
        f"{allowed_types[photo.content_type]}"
    )

    file_path = GALLERY_UPLOAD_DIR / filename

    file_path.write_bytes(contents)

    image_url = (
        f"{str(request.base_url).rstrip('/')}"
        f"/uploads/gallery/{filename}"
    )

    doc = {
        "id": new_id(),
        "title": title.strip() or "Barbershop photo",
        "category": category.strip() or "General",
        "image": image_url,
        "stored_filename": filename,
        "active": True,
        "created_at": now_utc().isoformat(),
    }

    await db.gallery.insert_one(doc)

    doc.pop("_id", None)

    return doc


@api.delete("/admin/gallery/{gid}")
async def delete_gallery(gid: str, admin: dict = Depends(require_admin)):
    await db.gallery.delete_one({"id": gid})
    return {"message": "Deleted"}


# --- Blackout dates ---
@api.post("/admin/blackouts")
async def create_blackout(body: BlackoutInput, admin: dict = Depends(require_admin)):
    if await db.blackouts.find_one({"date": body.date}):
        raise HTTPException(status_code=400, detail="Date already blocked")
    doc = {"id": new_id(), **body.model_dump()}
    await db.blackouts.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.delete("/admin/blackouts/{bid}")
async def delete_blackout(bid: str, admin: dict = Depends(require_admin)):
    await db.blackouts.delete_one({"id": bid})
    return {"message": "Deleted"}


# --- Settings ---
@api.put("/admin/settings")
async def update_settings(body: SettingsInput, admin: dict = Depends(require_admin)):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    await db.settings.update_one({"id": "shop"}, {"$set": updates}, upsert=True)
    s = await get_settings_doc()
    s.pop("id", None)
    return s


# ---------------------------------------------------------------------------
# Seed
# ---------------------------------------------------------------------------
DEFAULT_HOURS = {
    "mon": {"open": "09:00", "close": "18:00", "closed": False},
    "tue": {"open": "09:00", "close": "18:00", "closed": False},
    "wed": {"open": "09:00", "close": "18:00", "closed": False},
    "thu": {"open": "09:00", "close": "20:00", "closed": False},
    "fri": {"open": "09:00", "close": "20:00", "closed": False},
    "sat": {"open": "08:00", "close": "17:00", "closed": False},
    "sun": {"open": "10:00", "close": "16:00", "closed": True},
}


async def seed():
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@apexblade.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "id": new_id(), "name": "Shop Admin", "email": admin_email,
            "phone": "", "password_hash": hash_password(admin_password),
            "role": "admin", "created_at": now_utc().isoformat(),
        })
        logger.info("Seeded admin user")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email},
                                  {"$set": {"password_hash": hash_password(admin_password)}})

    if not await db.settings.find_one({"id": "shop"}):
        await db.settings.insert_one({
            "id": "shop", "shop_name": "Apex & Blade", "tagline": "Master Barbers. Timeless Cuts.",
            "address": "218 Craftsman Row, Downtown District", "phone": "(555) 018-2200",
            "email": "hello@apexblade.com", "instagram": "@apexblade",
            "about": "A modern barbershop rooted in classic craftsmanship. Precision fades, sculpted beards, and hot-towel shaves by master barbers.",
            "timezone": "America/New_York", "slot_interval": 30,
            "auto_confirm": True, "deposit_enabled": False, "hours": DEFAULT_HOURS,
        })

    if await db.services.count_documents({}) == 0:
        await db.services.insert_many([
            {"id": new_id(), "name": "Signature Cut", "description": "Consultation, precision cut, hot-towel finish & style.", "price": 45, "duration": 45, "category": "Haircut", "active": True, "featured": True, "image": "https://images.unsplash.com/photo-1562004760-aceed7bb0fe3?crop=entropy&cs=srgb&fm=jpg&q=85&w=800"},
            {"id": new_id(), "name": "Skin Fade", "description": "Bald/skin fade tapered to perfection with sharp lineup.", "price": 40, "duration": 40, "category": "Haircut", "active": True, "featured": True, "image": "https://images.unsplash.com/photo-1627100232173-acf3733f02bc?crop=entropy&cs=srgb&fm=jpg&q=85&w=800"},
            {"id": new_id(), "name": "Beard Sculpt", "description": "Beard shaping, line-up and conditioning.", "price": 25, "duration": 25, "category": "Beard", "active": True, "featured": False, "image": "https://images.unsplash.com/photo-1621605815971-fbc98d665033?crop=entropy&cs=srgb&fm=jpg&q=85&w=800"},
            {"id": new_id(), "name": "Cut & Beard Combo", "description": "Full haircut paired with a sculpted beard trim.", "price": 60, "duration": 60, "category": "Combo", "active": True, "featured": True, "image": "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?crop=entropy&cs=srgb&fm=jpg&q=85&w=800"},
            {"id": new_id(), "name": "Hot Towel Royal Shave", "description": "Traditional straight-razor shave with hot towels.", "price": 35, "duration": 35, "category": "Shave", "active": True, "featured": False, "image": "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?crop=entropy&cs=srgb&fm=jpg&q=85&w=800"},
            {"id": new_id(), "name": "The Kid's Cut", "description": "Clean, quick and comfortable cut for under 12s.", "price": 25, "duration": 30, "category": "Haircut", "active": True, "featured": False, "image": "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?crop=entropy&cs=srgb&fm=jpg&q=85&w=800"},
        ])

    if await db.addons.count_documents({}) == 0:
        await db.addons.insert_many([
            {"id": new_id(), "name": "Beard Line-up", "description": "Crisp cheek & neck lineup.", "price": 10, "duration": 10, "active": True},
            {"id": new_id(), "name": "Hair Wash", "description": "Cleanse & condition.", "price": 8, "duration": 10, "active": True},
            {"id": new_id(), "name": "Design Work", "description": "Custom hair design detailing.", "price": 15, "duration": 15, "active": True},
            {"id": new_id(), "name": "Grey Blending", "description": "Subtle color blend.", "price": 20, "duration": 20, "active": True},
        ])

    if await db.hairstyles.count_documents({}) == 0:
        await db.hairstyles.insert_many([
            {"id": new_id(), "title": "Skin Fade & Pompadour", "tag": "High Taper Fade", "image": "https://images.unsplash.com/photo-1562004760-aceed7bb0fe3?crop=entropy&cs=srgb&fm=jpg&q=85&w=800", "active": True},
            {"id": new_id(), "title": "Textured Crop & Beard", "tag": "Beard Sculpt", "image": "https://images.unsplash.com/photo-1627100232173-acf3733f02bc?crop=entropy&cs=srgb&fm=jpg&q=85&w=800", "active": True},
            {"id": new_id(), "title": "Executive Side Part", "tag": "Classic Cut", "image": "https://images.unsplash.com/photo-1662145349402-f78c521eccb0?crop=entropy&cs=srgb&fm=jpg&q=85&w=800", "active": True},
            {"id": new_id(), "title": "Slicked Back Taper", "tag": "Hot Towel Shave", "image": "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?crop=entropy&cs=srgb&fm=jpg&q=85&w=800", "active": True},
        ])

    if await db.gallery.count_documents({}) == 0:
        await db.gallery.insert_many([
            {"id": new_id(), "title": "Skin Fade", "category": "Fades", "image": "https://images.unsplash.com/photo-1562004760-aceed7bb0fe3?crop=entropy&cs=srgb&fm=jpg&q=85&w=800", "active": True},
            {"id": new_id(), "title": "Textured Crop", "category": "Cuts", "image": "https://images.unsplash.com/photo-1627100232173-acf3733f02bc?crop=entropy&cs=srgb&fm=jpg&q=85&w=800", "active": True},
            {"id": new_id(), "title": "Side Part", "category": "Cuts", "image": "https://images.unsplash.com/photo-1662145349402-f78c521eccb0?crop=entropy&cs=srgb&fm=jpg&q=85&w=800", "active": True},
            {"id": new_id(), "title": "Classic Combo", "category": "Combos", "image": "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?crop=entropy&cs=srgb&fm=jpg&q=85&w=800", "active": True},
            {"id": new_id(), "title": "Royal Shave", "category": "Shaves", "image": "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?crop=entropy&cs=srgb&fm=jpg&q=85&w=800", "active": True},
            {"id": new_id(), "title": "Shop Interior", "category": "Shop", "image": "https://images.unsplash.com/photo-1675599193990-33d71150902b?crop=entropy&cs=srgb&fm=jpg&q=85&w=800", "active": True},
        ])


@api.get("/")
async def root():
    return {"message": "Apex & Blade API"}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", FRONTEND_URL).split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.bookings.create_index([("date", 1)])
    await db.blackouts.create_index("date", unique=True)
    await seed()
    logger.info("Startup complete")


@app.on_event("shutdown")
async def on_shutdown():
    client.close()
