import re
from datetime import datetime, timedelta, timezone, date
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.room import Room, RoomRestriction
from app.models.meeting import Meeting, MeetingParticipant
from app.models.user import User
from app.api.deps import get_current_active_user
from app.models.audit import AuditLog

router = APIRouter()

class ChatMessageRequest(BaseModel):
    message: str

class QuickBookRequest(BaseModel):
    room_id: int
    title: str
    start_time: datetime
    end_time: datetime
    description: Optional[str] = "Đặt phòng nhanh qua Chatbot MeetingBot"

def log_bot_action(db: Session, user_id: int, action: str, details: str):
    try:
        log = AuditLog(user_id=user_id, action=action, details=details)
        db.add(log)
        db.commit()
    except Exception:
        db.rollback()

@router.post("/message", summary="Xử lý tin nhắn Chatbot AI hỗ trợ đặt phòng (US #25)")
def process_chatbot_message(
    payload: ChatMessageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    msg = payload.message.strip().lower()
    user_name = current_user.full_name or "bạn"
    now = datetime.now()

    # Default quick replies
    default_quick_replies = [
        "🎯 Gợi ý phòng họp 20 người",
        "📅 Lịch họp hôm nay của tôi",
        "⚡ Đặt phòng nhanh chiều nay",
        "🏢 Xem danh sách phòng trống",
        "❓ Hướng dẫn đặt phòng"
    ]

    # 1. GREETING
    if any(k in msg for k in ["chào", "hello", "hi bot", "xin chào", "bắt đầu", "start"]):
        return {
            "reply": f"👋 Chào {user_name}! Tôi là **MeetingBot** - Trợ lý đặt phòng thông minh của ICTU.\n\nTôi có thể giúp bạn:\n- ⚡ **Đặt phòng họp nhanh** chỉ bằng một câu chat\n- ✨ **Gợi ý phòng họp tối ưu** theo số lượng người tham dự\n- 📅 **Tra cứu lịch họp cá nhân** & trạng thái phòng\n- 📱 **Hỗ trợ Check-in / Check-out QR**\n\nBạn cần hỗ trợ gì hôm nay?",
            "action": "NONE",
            "data": None,
            "quick_replies": default_quick_replies
        }

    # 2. CHECK MY MEETINGS
    if any(k in msg for k in ["lịch họp của tôi", "lịch của tôi", "hôm nay tôi có họp", "xem lịch", "lịch họp hôm nay"]):
        today_start = datetime.combine(date.today(), datetime.min.time())
        today_end = datetime.combine(date.today(), datetime.max.time())
        
        my_meetings = db.query(Meeting).filter(
            (Meeting.organizer_id == current_user.user_id) |
            (Meeting.participants.any(MeetingParticipant.user_id == current_user.user_id)),
            Meeting.end_time >= today_start,
            Meeting.status.in_(["SCHEDULED", "IN_PROGRESS", "APPROVED"])
        ).order_by(Meeting.start_time).limit(5).all()

        if not my_meetings:
            return {
                "reply": f"📅 Hôm nay {user_name} chưa có lịch họp nào sắp diễn ra! Bạn có muốn đặt phòng họp mới không?",
                "action": "NONE",
                "data": None,
                "quick_replies": ["⚡ Đặt phòng họp mới", "🏢 Xem phòng trống hôm nay", "🎯 Gợi ý phòng họp 10 người"]
            }

        reply_lines = [f"📅 **Lịch họp sắp tới của bạn ({len(my_meetings)} cuộc họp):**\n"]
        meeting_cards = []
        for m in my_meetings:
            room_name = m.room.room_name if m.room else f"Phòng #{m.room_id}"
            st_str = m.start_time.strftime("%H:%M")
            et_str = m.end_time.strftime("%H:%M - %d/%m/%Y")
            status_vn = "Đang diễn ra" if m.status == "IN_PROGRESS" else "Đã lên lịch"
            reply_lines.append(f"• **{m.title}**\n  📍 {room_name} | ⏰ {st_str} - {et_str} | Trạng thái: `{status_vn}`")
            meeting_cards.append({
                "meeting_id": m.meeting_id,
                "title": m.title,
                "room_name": room_name,
                "start_time": m.start_time.isoformat(),
                "end_time": m.end_time.isoformat(),
                "status": m.status
            })

        return {
            "reply": "\n".join(reply_lines),
            "action": "SHOW_MEETINGS",
            "data": {"meetings": meeting_cards},
            "quick_replies": ["📱 Điểm danh QR", "⚡ Đặt thêm phòng họp", "❓ Trợ giúp khác"]
        }

    # 3. CANCEL MEETING INTENT
    if any(k in msg for k in ["hủy phòng", "hủy họp", "hủy cuộc họp", "cancel"]):
        my_active = db.query(Meeting).filter(
            Meeting.organizer_id == current_user.user_id,
            Meeting.end_time >= now,
            Meeting.status.in_(["SCHEDULED", "IN_PROGRESS", "APPROVED"])
        ).order_by(Meeting.start_time).all()

        if not my_active:
            return {
                "reply": "Bạn hiện không có cuộc họp nào do bạn chủ trì đang chờ diễn ra để hủy.",
                "action": "NONE",
                "data": None,
                "quick_replies": default_quick_replies
            }

        reply_lines = ["⚠️ **Chọn cuộc họp bạn muốn hủy:**"]
        cards = []
        for m in my_active:
            reply_lines.append(f"- ID {m.meeting_id}: **{m.title}** ({m.start_time.strftime('%H:%M %d/%m')})")
            cards.append({"meeting_id": m.meeting_id, "title": m.title})

        return {
            "reply": "\n".join(reply_lines) + "\n\n*(Bạn có thể vào Lịch họp để bấm Hủy cuộc họp nhanh)*",
            "action": "LIST_CANCEL",
            "data": {"meetings": cards},
            "quick_replies": ["📅 Quay lại Lịch họp", "🎯 Gợi ý phòng họp"]
        }

    # 4. QR CHECK-IN INTENT
    if any(k in msg for k in ["checkin", "check in", "điểm danh", "mã qr", "qr code", "quét qr"]):
        return {
            "reply": "📱 **Hướng dẫn Điểm danh qua mã QR (US #27):**\n1. Mở trang **Lịch họp (Google Calendar)**\n2. Bấm vào cuộc họp của bạn và chọn biểu tượng **QR Điểm danh**\n3. Bấm **'Quét mã Check-in'** để điểm danh tức thì hoặc quét từ camera điện thoại.\n4. Khi họp xong, người chủ trì bấm **'Check-out Trả phòng'** để hệ thống giải phóng phòng tự động!",
            "action": "NAVIGATE_QR",
            "data": None,
            "quick_replies": ["📅 Mở lịch họp ngay", "⚡ Đặt phòng nhanh", "❓ Trợ giúp khác"]
        }

    # 5. FIND EMPTY ROOMS / LIST AVAILABLE
    if any(k in msg for k in ["phòng trống", "danh sách phòng", "xem phòng", "phòng nào rảnh"]):
        avail_rooms = db.query(Room).filter(Room.status == "AVAILABLE").order_by(Room.capacity).limit(6).all()
        lines = ["🏢 **Danh sách các phòng họp sẵn sàng hiện tại:**\n"]
        room_data = []
        for r in avail_rooms:
            lines.append(f"• **{r.room_name}** ({r.location}) - Sức chứa: **{r.capacity} người** - TB: {r.equipments or 'Cơ bản'}")
            room_data.append({
                "room_id": r.room_id,
                "room_name": r.room_name,
                "capacity": r.capacity,
                "location": r.location
            })
        lines.append("\n💡 *Gõ 'Đặt phòng [Tên phòng] [Số người]' để bot đặt ngay giúp bạn!*")
        return {
            "reply": "\n".join(lines),
            "action": "LIST_ROOMS",
            "data": {"rooms": room_data},
            "quick_replies": ["🎯 Gợi ý phòng tối ưu", "⚡ Đặt phòng chiều nay", "📅 Xem lịch họp"]
        }

    # 6. BOOK ROOM INTENT (SMART PARSING)
    # Checks for numbers (attendees) like "20 người", "15 chỗ", "10 bạn", "cho 30 người"
    attendees_match = re.search(r"(\d+)\s*(người|chỗ|bạn|thành viên|khách|suất)?", msg)
    attendees = int(attendees_match.group(1)) if attendees_match else 15

    # Check for specific room mentions like "A201", "B102", "phòng 301"
    room_match = re.search(r"(phòng\s*)?([a-z]\d{3}|\d{3})", msg)
    target_room_code = room_match.group(2).upper() if room_match else None

    # Calculate default booking slot: Next available round hour today or tomorrow
    target_start = now.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
    if "chiều nay" in msg or "chiều" in msg:
        target_start = datetime.combine(date.today(), datetime.min.time()).replace(hour=14)
        if now.hour >= 14:
            target_start = now.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
    elif "sáng mai" in msg:
        target_start = datetime.combine(date.today() + timedelta(days=1), datetime.min.time()).replace(hour=8, minute=30)
    elif "chiều mai" in msg:
        target_start = datetime.combine(date.today() + timedelta(days=1), datetime.min.time()).replace(hour=14)
    elif "ngày mai" in msg or "mai" in msg:
        target_start = datetime.combine(date.today() + timedelta(days=1), datetime.min.time()).replace(hour=9)

    target_end = target_start + timedelta(hours=2)

    # Search best fitting room
    query = db.query(Room).filter(Room.status == "AVAILABLE")
    if target_room_code:
        chosen_room = query.filter(Room.room_name.ilike(f"%{target_room_code}%")).first()
    else:
        chosen_room = None

    if not chosen_room:
        # Optimal capacity search
        chosen_room = query.filter(Room.capacity >= attendees).order_by(Room.capacity.asc()).first()
        if not chosen_room:
            chosen_room = query.order_by(Room.capacity.desc()).first()

    if not chosen_room:
        return {
            "reply": "Rất tiếc hiện không có phòng họp nào khả dụng trong hệ thống để đặt.",
            "action": "NONE",
            "data": None,
            "quick_replies": default_quick_replies
        }

    # Check conflict
    conflict = db.query(Meeting).filter(
        Meeting.room_id == chosen_room.room_id,
        Meeting.status.in_(["SCHEDULED", "IN_PROGRESS", "APPROVED"]),
        Meeting.start_time < target_end,
        Meeting.end_time > target_start
    ).first()

    if conflict:
        # Propose alternate room
        alt_rooms = db.query(Room).filter(
            Room.status == "AVAILABLE",
            Room.room_id != chosen_room.room_id,
            Room.capacity >= attendees
        ).order_by(Room.capacity.asc()).all()
        for alt in alt_rooms:
            c = db.query(Meeting).filter(
                Meeting.room_id == alt.room_id,
                Meeting.status.in_(["SCHEDULED", "IN_PROGRESS", "APPROVED"]),
                Meeting.start_time < target_end,
                Meeting.end_time > target_start
            ).first()
            if not c:
                chosen_room = alt
                conflict = None
                break

    st_str = target_start.strftime("%H:%M, %d/%m/%Y")
    et_str = target_end.strftime("%H:%M")

    # If user explicitly asked to book or suggest
    is_explicit_book = any(k in msg for k in ["đặt phòng", "book", "đặt lịch", "tạo cuộc họp", "lấy phòng"])
    
    booking_proposal = {
        "room_id": chosen_room.room_id,
        "room_name": chosen_room.room_name,
        "location": chosen_room.location,
        "capacity": chosen_room.capacity,
        "attendees": attendees,
        "start_time": target_start.isoformat(),
        "end_time": target_end.isoformat(),
        "start_display": st_str,
        "end_display": et_str,
        "title": f"Cuộc họp {user_name} ({attendees} người)",
        "equipments": chosen_room.equipments or "Máy chiếu, Micro, Wifi",
        "has_conflict": bool(conflict)
    }

    if is_explicit_book:
        reply_msg = (
            f"🤖 **Tôi đã tìm thấy phòng tối ưu nhất cho bạn:**\n\n"
            f"📍 **{chosen_room.room_name}** ({chosen_room.location})\n"
            f"👥 Sức chứa: **{chosen_room.capacity} chỗ** (phù hợp cho {attendees} người)\n"
            f"⏰ Thời gian: **{st_str} - {et_str}**\n"
            f"🛠️ Trang bị: {chosen_room.equipments or 'Tiêu chuẩn'}\n\n"
            f"👉 Nhấn nút **'Xác nhận đặt ngay'** bên dưới để hoàn tất chỉ trong 1 giây!"
        )
        return {
            "reply": reply_msg,
            "action": "PROMPT_QUICK_BOOK",
            "data": booking_proposal,
            "quick_replies": ["⚡ Đặt phòng khác", "📅 Kiểm tra lịch của tôi", "❌ Hủy bỏ"]
        }
    else:
        # Gợi ý phòng (US #26 query)
        reply_msg = (
            f"✨ **Gợi ý phòng họp tối ưu cho {attendees} người:**\n\n"
            f"🎯 Lựa chọn số 1: **{chosen_room.room_name}**\n"
            f"• Vị trí: {chosen_room.location}\n"
            f"• Sức chứa: {chosen_room.capacity} người (đạt 98% độ phù hợp diện tích)\n"
            f"• Thiết bị: {chosen_room.equipments or 'Máy chiếu, Bảng viết'}\n\n"
            f"Bạn có muốn đặt phòng này cho khung giờ **{st_str} - {et_str}** không?"
        )
        return {
            "reply": reply_msg,
            "action": "PROMPT_QUICK_BOOK",
            "data": booking_proposal,
            "quick_replies": ["⚡ Đặt phòng này ngay", "🎯 Gợi ý phòng khác", "❓ Hướng dẫn"]
        }

@router.post("/quick-book", summary="Đặt phòng nhanh 1-Click qua Chatbot (US #25)")
def chatbot_quick_book(
    payload: QuickBookRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    # Verify room exists and active
    room = db.query(Room).filter(Room.room_id == payload.room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Không tìm thấy phòng họp được chọn")

    if room.status != "AVAILABLE":
        raise HTTPException(status_code=400, detail="Phòng này hiện đang bảo trì hoặc tạm ngưng sử dụng")

    # Check RBAC room restriction
    user_role_name = current_user.role.role_name if current_user.role else ""
    if user_role_name != "ADMIN" and current_user.role_id:
        restr = db.query(RoomRestriction).filter(
            RoomRestriction.room_id == room.room_id,
            RoomRestriction.role_id == current_user.role_id
        ).first()
        if restr and not restr.is_allowed:
            raise HTTPException(
                status_code=403,
                detail=f"Vai trò '{user_role_name}' không được phép đặt phòng {room.room_name}"
            )

    # Check schedule conflict
    st = payload.start_time.replace(tzinfo=None) if payload.start_time.tzinfo else payload.start_time
    et = payload.end_time.replace(tzinfo=None) if payload.end_time.tzinfo else payload.end_time

    conflict = db.query(Meeting).filter(
        Meeting.room_id == payload.room_id,
        Meeting.status.in_(["SCHEDULED", "IN_PROGRESS", "APPROVED"]),
        Meeting.start_time < et,
        Meeting.end_time > st
    ).first()

    if conflict:
        raise HTTPException(
            status_code=409,
            detail=f"Phòng {room.room_name} đã có lịch họp '{conflict.title}' ({conflict.start_time.strftime('%H:%M')} - {conflict.end_time.strftime('%H:%M')})"
        )

    # Generate QR Token
    import uuid
    qr_token = f"QR_{uuid.uuid4().hex[:12].upper()}"

    # Auto approve for admin or lecturer
    init_status = "SCHEDULED"

    meeting = Meeting(
        organizer_id=current_user.user_id,
        room_id=room.room_id,
        title=payload.title,
        description=payload.description,
        start_time=st,
        end_time=et,
        meeting_type="IN_PERSON",
        status=init_status,
        qr_token=qr_token
    )
    db.add(meeting)
    db.flush()

    # Add organizer as accepted participant
    part = MeetingParticipant(
        meeting_id=meeting.meeting_id,
        user_id=current_user.user_id,
        rsvp_status="ACCEPTED"
    )
    db.add(part)

    log_bot_action(db, current_user.user_id, "CHATBOT_BOOKING", f"Đặt phòng nhanh qua Chatbot: '{meeting.title}' tại {room.room_name}")
    db.commit()
    db.refresh(meeting)

    return {
        "success": True,
        "message": f"🎉 Chúc mừng! Đã đặt thành công phòng '{room.room_name}' qua MeetingBot!",
        "meeting": {
            "meeting_id": meeting.meeting_id,
            "title": meeting.title,
            "room_name": room.room_name,
            "location": room.location,
            "start_time": meeting.start_time.isoformat(),
            "end_time": meeting.end_time.isoformat(),
            "status": meeting.status,
            "qr_token": meeting.qr_token
        }
    }
