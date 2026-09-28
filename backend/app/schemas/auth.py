from pydantic import BaseModel, EmailStr
from typing import Optional

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    full_name: str
    email: str
    role: str

class TokenPayload(BaseModel):
    sub: Optional[str] = None
    exp: Optional[int] = None
