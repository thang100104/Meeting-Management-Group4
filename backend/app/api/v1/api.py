from fastapi import APIRouter
from app.api.v1.endpoints import auth, users, roles, departments, rooms, meetings, equipments

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["1. Xác thực & Tài khoản (Auth)"])
api_router.include_router(users.router, prefix="/users", tags=["2. Quản lý Người dùng (Users - US #18, #19, #20)"])
api_router.include_router(roles.router, prefix="/roles", tags=["3. Quản lý Vai trò (Roles)"])
api_router.include_router(departments.router, prefix="/departments", tags=["4. Quản lý Phòng ban (Departments)"])
api_router.include_router(rooms.router, prefix="/rooms", tags=["5. Quản lý Phòng họp (Rooms - US #7, #10, #11, #21)"])
api_router.include_router(meetings.router, prefix="/meetings", tags=["6. Đặt lịch họp (Meetings - US #1, #2, #4, #8, #9)"])
api_router.include_router(equipments.router, prefix="/equipments", tags=["7. Quản lý & Đặt mượn Thiết bị (Equipments - US #12, #13, #14)"])
