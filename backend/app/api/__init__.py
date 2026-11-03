from fastapi import APIRouter, Depends

from app.api import me
from app.core.auth import require_owner

# Every router included here requires the owner's Supabase token.
protected_router = APIRouter(dependencies=[Depends(require_owner)])
protected_router.include_router(me.router)
