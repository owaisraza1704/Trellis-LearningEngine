"""Local provider preferences and the source library API."""

from pathlib import Path
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import delete
from sqlmodel import Session, select

from . import ai, evidence
from .config import settings
from .db import get_session
from .models import AppSettings, Chunk, LearningPath, Source

router = APIRouter()


class ProviderSelection(BaseModel):
    provider: Literal["azure", "openai", "openrouter", "ollama"]
    model: str = Field(min_length=1, max_length=200)


class ConnectionCheck(ai.Output):
    status: Literal["ready"]


class URLInput(BaseModel):
    url: str = Field(min_length=1, max_length=4000)
    path_id: str | None = None


class TextInput(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1, max_length=evidence.MAX_DOCUMENT_CHARACTERS)
    path_id: str | None = None


def check_path(session: Session, path_id: str | None) -> None:
    if path_id and not session.get(LearningPath, path_id):
        raise HTTPException(404, "Learning path not found.")


def require_source(session: Session, source_id: str) -> Source:
    source = session.get(Source, source_id)
    if not source:
        raise HTTPException(404, "Source not found.")
    return source


@router.get("/settings")
def get_settings(session: Session = Depends(get_session)):
    return ai.settings_view(session)


@router.put("/settings")
def update_settings(body: ProviderSelection, session: Session = Depends(get_session)):
    if not body.model.strip():
        raise HTTPException(422, "Enter a model or deployment name.")
    _, _, configured = ai.provider_defaults(body.provider)
    if not configured:
        raise HTTPException(422, "Configure this provider in the server .env and restart first.")
    selected = session.get(AppSettings, 1) or AppSettings()
    selected.provider, selected.model = body.provider, body.model.strip()
    session.add(selected)
    session.commit()
    return ai.settings_view(session)


@router.post("/settings/test")
def test_settings(
    body: ProviderSelection | None = None, session: Session = Depends(get_session),
):
    provider, model = (body.provider, body.model) if body else ai.selected_provider(session)
    try:
        ai.structured_completion(provider, model, ConnectionCheck, [
            {"role": "system", "content": "Return a JSON object with status set to ready."},
            {"role": "user", "content": "Check structured output support."},
        ])
        return {"ok": True, "message": "Connected. This model returned valid structured output."}
    except HTTPException as error:
        return {"ok": False, "message": str(error.detail)}


@router.get("/sources")
def list_sources(path_id: str | None = None, session: Session = Depends(get_session)):
    statement = select(Source).order_by(Source.created_at.desc())
    if path_id:
        check_path(session, path_id)
        statement = statement.where(Source.path_id == path_id)
    sources = session.exec(statement).all()
    stale_ids = evidence.outdated_source_ids(
        session, [source.id for source in sources], ai.embedding_profile()[3],
    )
    return [evidence.source_view(source, needs_reindex=source.id in stale_ids) for source in sources]


@router.post("/sources/upload", status_code=202)
def upload_source(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    path_id: str | None = Form(None),
    session: Session = Depends(get_session),
):
    check_path(session, path_id)
    name = Path(file.filename or "Document").name
    extension = Path(name).suffix.lower()
    if extension not in {".pdf", ".md", ".txt"}:
        raise HTTPException(422, "Upload a PDF, Markdown (.md), or text (.txt) document.")
    data = file.file.read(evidence.MAX_DOWNLOAD_BYTES + 1)
    if len(data) > evidence.MAX_DOWNLOAD_BYTES:
        raise HTTPException(413, "Upload a file smaller than 20 MB.")
    if not data:
        raise HTTPException(422, "The uploaded file is empty.")
    source = Source(path_id=path_id, title=name[:200], kind="upload")
    directory = settings.data_dir / "sources"
    directory.mkdir(parents=True, exist_ok=True)
    destination = directory / f"{source.id}{extension}"
    destination.write_bytes(data)
    source.file_path = f"sources/{destination.name}"
    session.add(source)
    session.commit()
    session.refresh(source)
    background_tasks.add_task(evidence.process_source, source.id)
    return evidence.source_view(source)


@router.post("/sources/url", status_code=202)
def add_url(
    body: URLInput, background_tasks: BackgroundTasks, session: Session = Depends(get_session),
):
    check_path(session, body.path_id)
    url, _ = evidence.public_url(body.url.strip())
    source = Source(path_id=body.path_id, title=url.host, kind="url", url=str(url))
    session.add(source)
    session.commit()
    session.refresh(source)
    background_tasks.add_task(evidence.process_source, source.id)
    return evidence.source_view(source)


@router.post("/sources/text", status_code=202)
def add_text(
    body: TextInput, background_tasks: BackgroundTasks, session: Session = Depends(get_session),
):
    check_path(session, body.path_id)
    if not body.title.strip() or not body.content.strip():
        raise HTTPException(422, "Enter a title and readable text.")
    source = Source(
        path_id=body.path_id, title=body.title.strip(), kind="text", content=body.content,
    )
    session.add(source)
    session.commit()
    session.refresh(source)
    background_tasks.add_task(evidence.process_source, source.id)
    return evidence.source_view(source)


@router.get("/sources/{source_id}")
def get_source(source_id: str, session: Session = Depends(get_session)):
    source = require_source(session, source_id)
    chunks = session.exec(select(Chunk).where(Chunk.source_id == source_id).order_by(Chunk.position)).all()
    return {
        **evidence.source_view(source),
        "excerpts": [
            {"id": chunk.id, "excerpt": chunk.content, "location": chunk.location}
            for chunk in chunks
        ],
        "embedding_profile": chunks[0].profile if chunks else None,
        "needs_reindex": any(chunk.profile != ai.embedding_profile()[3] for chunk in chunks),
    }


@router.post("/sources/{source_id}/retry", status_code=202)
def retry_source(
    source_id: str, background_tasks: BackgroundTasks, session: Session = Depends(get_session),
):
    source = require_source(session, source_id)
    if source.status in {"pending", "processing"}:
        raise HTTPException(409, "This source is already being indexed.")
    source.status, source.error = "pending", None
    session.add(source)
    session.commit()
    session.refresh(source)
    background_tasks.add_task(evidence.process_source, source.id)
    return evidence.source_view(source)


@router.delete("/sources/{source_id}", status_code=204)
def delete_source(source_id: str, session: Session = Depends(get_session)):
    source = require_source(session, source_id)
    if source.status in {"pending", "processing"}:
        raise HTTPException(409, "Wait for indexing to finish before removing this source.")
    session.exec(delete(Chunk).where(Chunk.source_id == source_id))
    session.delete(source)
    session.commit()
    if source.file_path:
        evidence.source_file_path(source.file_path).unlink(missing_ok=True)
