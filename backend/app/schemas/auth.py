from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, Literal

class EmailInput(BaseModel):
    @field_validator('email', mode='before', check_fields=False)
    @classmethod
    def normalize_email(cls, value):
        return value.strip().lower() if isinstance(value, str) else value

class LoginRequest(EmailInput):
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

class RegisterRequest(EmailInput):
    full_name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=6, max_length=72)
    role_name: Literal['PARTICIPANT'] = 'PARTICIPANT'

    @field_validator('full_name', mode='before')
    @classmethod
    def trim_name(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator('password')
    @classmethod
    def check_bcrypt_length(cls, value):
        if len(value.encode('utf-8')) > 72:
            raise ValueError('Mật khẩu tối đa 72 byte UTF-8')
        return value

class ForgotPasswordRequest(BaseModel):
    email: EmailStr
