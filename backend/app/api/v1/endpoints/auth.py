from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import verify_password, create_access_token, get_password_hash
from app.models.user import User
from app.schemas.auth import LoginRequest, Token, RegisterRequest
from app.models.role import Role
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from app.schemas.user import UserOut, UserChangePassword
from app.api.deps import get_current_active_user

router = APIRouter()

@router.post("/register", response_model=UserOut, status_code=201, summary="Đăng ký tài khoản sinh viên")
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(func.lower(User.email) == data.email).first():
        raise HTTPException(status_code=409, detail="Email này đã được đăng ký. Vui lòng đăng nhập.")
    role = db.query(Role).filter(Role.role_name == 'PARTICIPANT').first()
    if not role:
        raise HTTPException(status_code=503, detail="Vai trò sinh viên chưa được khởi tạo. Vui lòng liên hệ quản trị viên.")
    user = User(full_name=data.full_name, email=data.email, password_hash=get_password_hash(data.password), role_id=role.role_id, status='ACTIVE')
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Email này đã được đăng ký. Vui lòng đăng nhập.")
    db.refresh(user)
    return user

@router.post("/login", response_model=Token, summary="Đăng nhập bằng JSON (email + password)")
def login_json(data: LoginRequest, db: Session = Depends(get_db)):
    """Xác thực email/password, trả về JWT Token và thông tin User."""
    user = db.query(User).filter(func.lower(User.email) == data.email).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email hoặc mật khẩu không chính xác"
        )
    if user.status != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tài khoản đã bị tạm khóa"
        )
    
    access_token = create_access_token(subject=user.user_id)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user.user_id,
        "full_name": user.full_name,
        "email": user.email,
        "role": user.role.role_name if user.role else "UNKNOWN"
    }

@router.post("/token-login", response_model=Token, summary="Đăng nhập chuẩn OAuth2 Form (cho Swagger UI / Authorize button)")
def login_oauth2(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email hoặc mật khẩu không chính xác"
        )
    if user.status != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tài khoản đã bị tạm khóa"
        )
    
    access_token = create_access_token(subject=user.user_id)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user.user_id,
        "full_name": user.full_name,
        "email": user.email,
        "role": user.role.role_name if user.role else "UNKNOWN"
    }

@router.get("/me", response_model=UserOut, summary="Lấy thông tin tài khoản hiện tại")
def read_current_user(current_user: User = Depends(get_current_active_user)):
    """Trả về toàn bộ thông tin User đang đăng nhập (bao gồm Role, Department)."""
    return current_user

@router.post("/logout", summary="Đăng xuất và hủy phiên làm việc")
def logout(current_user: User = Depends(get_current_active_user)):
    """Đăng xuất. Client sẽ xóa JWT token khỏi localStorage.
    
    Với kiến trúc JWT stateless, server không lưu session.
    Endpoint này xác nhận token còn hợp lệ và trả về thông báo thành công
    để client biết cần xóa token.
    """
    return {
        "message": "Đăng xuất thành công",
        "user_id": current_user.user_id
    }

@router.post("/change-password", summary="Đổi mật khẩu tài khoản hiện tại")
def change_password(
    data: UserChangePassword,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    if not verify_password(data.old_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mật khẩu cũ không chính xác"
        )
    if len(data.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mật khẩu mới phải có ít nhất 6 ký tự"
        )
    
    current_user.password_hash = get_password_hash(data.new_password)
    db.commit()
    return {"message": "Đổi mật khẩu thành công"}
