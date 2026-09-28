from pydantic import BaseModel

class RoleBase(BaseModel):
    role_name: str

class RoleOut(RoleBase):
    role_id: int

    class Config:
        from_attributes = True
