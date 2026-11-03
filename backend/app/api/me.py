from fastapi import APIRouter
from pydantic import BaseModel

from app.core.auth import Owner

router = APIRouter(tags=["auth"])


class MeResponse(BaseModel):
    id: str
    email: str | None


@router.get("/me", response_model=MeResponse)
def me(user: Owner) -> MeResponse:
    """The signed-in owner. Used by the frontend to confirm the session works end to end."""
    return MeResponse(id=user.id, email=user.email)
