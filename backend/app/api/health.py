from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

from app import __version__

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    status: Literal["ok"]
    version: str


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    """Liveness check used by the frontend, CI and the hosting platform."""
    return HealthResponse(status="ok", version=__version__)
