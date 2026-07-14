from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app import models  # noqa: F401
from app.api.router import api_router
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.database.seed import seed_initial_data
from app.database.migrations import ensure_runtime_schema
from app.database.session import database_manager
from app.middleware.request_logging import RequestLoggingMiddleware
from app.services.file_storage_service import FileStorageService


@asynccontextmanager
async def lifespan(app: FastAPI):
    database_manager.create_all()
    ensure_runtime_schema()
    with database_manager.session_factory() as db:
        seed_initial_data(db)
    yield


def create_app() -> FastAPI:
    configure_logging()
    settings = get_settings()
    app = FastAPI(title=settings.app_name, description=settings.slogan, version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(RequestLoggingMiddleware)
    app.include_router(api_router, prefix=settings.api_prefix)
    storage = FileStorageService()
    storage.ensure_directories()
    app.mount(settings.media_url_prefix, StaticFiles(directory=settings.media_root), name="media")
    app.mount("/static/uploads", StaticFiles(directory=settings.media_root), name="legacy-media")

    @app.get("/health", tags=["Health"])
    def health() -> dict[str, str]:
        return {"status": "ok", "service": settings.app_name}

    return app


app = create_app()
