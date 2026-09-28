from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import verify_password, create_access_token, get_password_hash
from app.models.user import User
from app.schemas.auth import LoginRequest, Token
from app.schemas.user import UserOut, UserChangePassword
from app.api.deps import get_current_active_user

router = APIRouter()

@router.post("/login", response_model=Token, summary="Đăng nhập bằng JSON (email + password)")
def login_json(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
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
    return current_user

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
