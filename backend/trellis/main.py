import logging
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import Session, select

from . import core, notebook, provider_routes
from .config import settings
from .db import engine
from .models import ExportRecord, Source

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    from .evidence import recover_pending_sources
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    with Session(engine) as session:
        for export in session.exec(select(ExportRecord).where(ExportRecord.status == "pending")).all():
            export.status = "failed"
            export.error = "Export was interrupted by an application restart. Your selected material is saved; export it again."
            session.add(export)
        session.commit()
        source_ids = list(session.exec(select(Source.id).where(Source.status.in_(["pending", "processing"]))).all())
    threading.Thread(target=recover_pending_sources, args=(source_ids,), daemon=True,
                     name="source-recovery").start()
    yield


app = FastAPI(title="Trellis", version="0.1.0", lifespan=lifespan)
app.include_router(core.router, prefix="/api")
app.include_router(provider_routes.router, prefix="/api")
app.include_router(notebook.router, prefix="/api")


@app.get("/api/health")
def health():
    with Session(engine) as session:
        session.exec(text("SELECT 1")).one()
    return {"status": "ok", "database": "ok"}


@app.exception_handler(SQLAlchemyError)
async def database_error(request, error):
    logger.error("Database operation failed (%s)", type(error).__name__)
    return JSONResponse(status_code=503, content={"detail": "The local database is unavailable or the change could not be saved. Your previous saved data is intact. Check the database and try again."})
