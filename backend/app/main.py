from fastapi import APIRouter, Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api import health, me, positions, sessions, techniques
from app.config import get_settings
from app.core.auth import require_owner


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        version=__version__,
        # Keep the interactive docs off the public deployment.
        docs_url=None if settings.is_production else "/docs",
        redoc_url=None,
        openapi_url=None if settings.is_production else "/openapi.json",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health.router)

    # Everything except /health requires the owner's Supabase token.
    protected = APIRouter(dependencies=[Depends(require_owner)])
    protected.include_router(me.router)
    protected.include_router(positions.router)
    protected.include_router(techniques.router)
    protected.include_router(sessions.router)
    app.include_router(protected)
    return app
