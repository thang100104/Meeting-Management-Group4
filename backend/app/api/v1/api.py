from fastapi import APIRouter
from app.api.v1.endpoints import auth, users, roles, departments, rooms, meetings, equipments, equipment_requests

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["1. XÃ¡c thá»±c & TÃ i khoáº£n (Auth)"])
api_router.include_router(users.router, prefix="/users", tags=["2. Quáº£n lÃ½ NgÆ°á»i dÃ¹ng (Users - US #18, #19, #20)"])
api_router.include_router(roles.router, prefix="/roles", tags=["3. Quáº£n lÃ½ Vai trÃ² (Roles)"])
api_router.include_router(departments.router, prefix="/departments", tags=["4. Quáº£n lÃ½ PhÃ²ng ban (Departments)"])
api_router.include_router(rooms.router, prefix="/rooms", tags=["5. Quáº£n lÃ½ PhÃ²ng há»p (Rooms - US #7, #10, #11, #21)"])
api_router.include_router(meetings.router, prefix="/meetings", tags=["6. Äáº·t lá»‹ch há»p (Meetings - US #1, #2, #4, #8, #9)"])
api_router.include_router(equipments.router, prefix="/equipments", tags=["7. Quáº£n lÃ½ & Äáº·t mÆ°á»£n Thiáº¿t bá»‹ (Equipments - US #12, #13, #14)"])

api_router.include_router(equipment_requests.router, prefix="/equipment-requests", tags=["8. Yeu cau muon Thiet bi"])