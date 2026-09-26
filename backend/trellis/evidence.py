"""Durable source ingestion and scoped pgvector retrieval."""

import io
import ipaddress
import socket
from pathlib import Path
from urllib.parse import urljoin, urlsplit

import httpx
import trafilatura
from ddgs import DDGS
from fastapi import HTTPException
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pypdf import PdfReader
from sqlalchemy import delete, func, update
from sqlmodel import Session, select

from .ai import embed_texts
from .config import settings
from .db import engine
from .models import Chunk, Source

MAX_DOWNLOAD_BYTES = 20 * 1024 * 1024
MAX_DOCUMENT_CHARACTERS = 500_000


def source_file_path(stored_path: str) -> Path:
    # Legacy host paths supply only the filename; files always live in the current data directory.
    return settings.data_dir / "sources" / Path(stored_path).name


def public_url(url: str) -> tuple[httpx.URL, str]:
    try:
        parsed = urlsplit(url)
        if (
            parsed.scheme not in {"http", "https"} or not parsed.hostname
            or parsed.username or parsed.password or parsed.port not in {None, 80, 443}
        ):
            raise ValueError
        addresses = socket.getaddrinfo(parsed.hostname, parsed.port or 443, type=socket.SOCK_STREAM)
        ips = [item[4][0] for item in addresses]
        if not ips or any(not ipaddress.ip_address(address).is_global for address in ips):
            raise ValueError
        return httpx.URL(url), ips[0]
    except (ValueError, socket.gaierror, httpx.InvalidURL):
        raise HTTPException(422, "Use a public HTTP(S) source URL on port 80 or 443.") from None


def fetch_document(url: str) -> tuple[bytes, str, str]:
    """Validate each redirect and pin DNS so a source cannot reach local services."""
    with httpx.Client(timeout=25, follow_redirects=False, trust_env=False) as client:
        for _ in range(5):
            original, address = public_url(url)
            pinned = original.copy_with(host=address)
            request = client.build_request(
                "GET", pinned,
                headers={
                    "Host": original.netloc.decode(),
                    "User-Agent": "TrellisLocal/0.1 (learning evidence reader)",
                },
                extensions={"sni_hostname": original.host},
            )
            response = client.send(request, stream=True)
            try:
                if response.is_redirect:
                    location = response.headers.get("location")
                    if not location:
                        raise HTTPException(422, "The source returned an invalid redirect.")
                    url = urljoin(url, location)
                    continue
                response.raise_for_status()
                content = bytearray()
                for part in response.iter_bytes():
                    content.extend(part)
                    if len(content) > MAX_DOWNLOAD_BYTES:
                        raise HTTPException(413, "The source exceeds the 20 MB download limit.")
                return bytes(content), response.headers.get("content-type", ""), str(original)
            finally:
                response.close()
    raise HTTPException(422, "The source redirected too many times.")


def document_sections(source: Source) -> list[tuple[str, str]]:
    content_type = ""
    if source.url:
        data, content_type, final_url = fetch_document(source.url)
        source.url = final_url
    elif source.file_path:
        data = source_file_path(source.file_path).read_bytes()
    else:
        return [(source.content, "Pasted material")]
    if data.startswith(b"%PDF") or (source.file_path or "").lower().endswith(".pdf"):
        reader = PdfReader(io.BytesIO(data))
        if reader.is_encrypted:
            raise HTTPException(422, "Encrypted PDFs are not supported. Upload an unlocked copy.")
        return [(page.extract_text() or "", f"Page {index + 1}") for index, page in enumerate(reader.pages)]
    text = data.decode("utf-8-sig", errors="replace")
    if source.url and ("html" in content_type or "<html" in text[:1000].lower()):
        extracted = trafilatura.extract(
            text, include_tables=True, include_comments=False,
            # Microsoft Learn includes an inactive authorization template beside public articles.
            prune_xpath="//*[@unauthorized-private-section and @hidden]",
        )
        metadata = trafilatura.extract_metadata(text)
        if metadata and metadata.title:
            source.title = metadata.title[:200]
        if not extracted:
            raise HTTPException(422, "No readable article text was found at this URL.")
        text = extracted
    elif source.url and content_type and not any(
        kind in content_type for kind in ("text/", "json", "xml")
    ):
        raise HTTPException(422, "This URL is not a readable web page, PDF, or text document.")
    return [(text, "Article text" if source.url else "Document text")]


def ingestion_error(error: Exception) -> str:
    if isinstance(error, HTTPException):
        return str(error.detail)
    if isinstance(error, httpx.HTTPStatusError):
        return f"The source returned HTTP {error.response.status_code}. Check the URL or upload its text."
    if isinstance(error, httpx.HTTPError):
        return "Could not download this source. Check the URL and connection, then retry."
    if isinstance(error, OSError):
        return "The stored source file could not be read. Upload the file again."
    return "This source could not be parsed or indexed. Try a readable PDF, Markdown, or text file."


def prepare_source_chunks(source: Source) -> list[Chunk]:
    """Read and embed material before replacing an index or saving a discovered page."""
    sections = document_sections(source)
    if sum(len(text) for text, _ in sections) > MAX_DOCUMENT_CHARACTERS:
        raise HTTPException(413, "The source exceeds 500,000 text characters. Split it into smaller files.")
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1800, chunk_overlap=220, add_start_index=True,
    )
    documents = splitter.create_documents(
        [text for text, _ in sections], [{"section": location} for _, location in sections],
    )
    documents = [document for document in documents if document.page_content.strip()]
    if not documents:
        raise HTTPException(
            422, "No extractable text was found. Scanned PDFs need OCR before uploading."
        )
    vectors, profile = embed_texts([document.page_content for document in documents])
    chunks = [Chunk(
        source_id=source.id, content=document.page_content, position=position,
        location=f"{document.metadata['section']}, character {document.metadata['start_index'] + 1}",
        embedding=vector, profile=profile,
    ) for position, (document, vector) in enumerate(zip(documents, vectors, strict=True))]
    source.content = "\n\n".join(text for text, _ in sections)
    source.chunk_count, source.status, source.error = len(chunks), "ready", None
    return chunks


def index_source(session: Session, source: Source) -> None:
    source.status, source.error = "processing", None
    session.add(source)
    session.commit()
    try:
        chunks = prepare_source_chunks(source)
        # Replace the index only when parsing and all embedding batches have succeeded.
        session.exec(delete(Chunk).where(Chunk.source_id == source.id))
        session.add_all(chunks)
        session.add(source)
        session.commit()
    except Exception as error:
        session.rollback()
        source = session.get(Source, source.id)
        if source:
            source.status, source.error = "failed", ingestion_error(error)
            session.add(source)
            session.commit()


def process_source(source_id: str) -> None:
    with Session(engine) as session:
        claimed = session.exec(update(Source).where(
            Source.id == source_id, Source.status == "pending",
        ).values(status="processing", error=None).returning(Source.id)).first()
        session.commit()
        if claimed:
            source = session.get(Source, source_id)
            index_source(session, source)


def recover_pending_sources(source_ids: list[str] | None = None) -> None:
    """Resume durable ingestion records interrupted by a local app restart."""
    with Session(engine) as session:
        statement = select(Source).where(Source.status.in_(["pending", "processing"]))
        if source_ids is not None:
            statement = statement.where(Source.id.in_(source_ids))
        sources = session.exec(statement).all()
        for source in sources:
            source.status = "pending"
            session.add(source)
        source_ids = [source.id for source in sources]
        session.commit()
    for source_id in source_ids:
        process_source(source_id)


def source_view(source: Source, *, needs_reindex: bool = False) -> dict:
    return {**source.model_dump(exclude={"file_path", "content"}), "needs_reindex": needs_reindex}


def outdated_source_ids(session: Session, source_ids: list[str], profile: str) -> set[str]:
    if not source_ids:
        return set()
    return set(session.exec(select(Chunk.source_id).where(
        Chunk.source_id.in_(source_ids), Chunk.profile != profile,
    ).distinct()).all())


def snapshot(chunk: Chunk, source: Source) -> dict:
    return {
        "id": chunk.id, "source_id": source.id, "title": source.title,
        "url": source.url, "excerpt": chunk.content, "location": chunk.location,
        "kind": source.kind,
    }


def ranked_chunks(session: Session, sources: list[Source], vector: list[float], profile: str) -> list[dict]:
    if not sources:
        return []
    distance = Chunk.embedding.cosine_distance(vector)
    statement = (
        select(Chunk, Source, distance.label("distance"))
        .join(Source, Chunk.source_id == Source.id)
        .where(
            Source.id.in_([source.id for source in sources]), Source.status == "ready",
            Chunk.profile == profile, func.vector_dims(Chunk.embedding) == len(vector),
        )
        .order_by(distance).limit(8)
    )
    rows = session.exec(statement).all()
    return [snapshot(chunk, source) for chunk, source, score in rows if score < 0.8]


def web_sources(
    session: Session, query: str, path_id: str | None, *,
    vector: list[float], profile: str, source_ids: list[str] | None = None,
) -> tuple[list[Source], list[str]]:
    warnings = []
    ready = []
    added = 0
    try:
        # Search snippets only discover URLs; they are never used as factual evidence.
        results = DDGS(timeout=15).text(query[:500], max_results=settings.search_max_results)
    except Exception:
        return [], ["Web search is unavailable. Add source URLs or upload relevant documents."]
    sources = session.exec(select(Source).where(Source.path_id == path_id)).all()
    if path_id is None:
        sources = [source for source in sources if source.kind == "web" or source.id in (source_ids or [])]
    existing = {
        str(httpx.URL(source.url).copy_with(fragment=None)): source
        for source in sources if source.url
    }
    visited = set()
    for result in results:
        url = result.get("href") or result.get("url")
        if not url:
            continue
        try:
            parsed, _ = public_url(url)
            url = str(parsed.copy_with(fragment=None))
        except HTTPException:
            continue
        if url in visited:
            continue
        visited.add(url)
        source = existing.get(url)
        if source:
            if ranked_chunks(session, [source], vector, profile):
                ready.append(source)
        else:
            source = Source(path_id=path_id, title=(result.get("title") or url)[:200], kind="web", url=url)
            try:
                chunks = prepare_source_chunks(source)
                final_url = str(httpx.URL(source.url).copy_with(fragment=None))
                source.url = final_url
                # A redirect can lead to material already supplied by the learner.
                duplicate = existing.get(final_url)
                if duplicate:
                    if duplicate not in ready and ranked_chunks(session, [duplicate], vector, profile):
                        ready.append(duplicate)
                else:
                    with session.begin_nested() as discovery:
                        session.add(source)
                        session.flush()
                        session.add_all(chunks)
                        session.flush()
                        if not ranked_chunks(session, [source], vector, profile):
                            discovery.rollback()
                            continue
                    session.commit()
                    existing[final_url] = source
                    ready.append(source)
                    added += 1
                visited.add(final_url)
            except Exception as error:
                warnings.append(f"A web source could not be indexed: {ingestion_error(error)}")
        if added >= 3:
            break
    return ready, warnings


def retrieve_evidence(
    session: Session, query: str, *, path_id: str | None = None,
    source_ids: list[str] | None = None, supplement_web: bool = False,
) -> dict:
    warnings = []
    if path_id:
        sources = session.exec(select(Source).where(Source.path_id == path_id)).all()
    elif source_ids:
        sources = session.exec(select(Source).where(Source.id.in_(source_ids))).all()
        if len(sources) != len(set(source_ids)) or any(source.path_id for source in sources):
            raise HTTPException(409, "Choose available unattached sources for a new learning path.")
        if any(source.status != "ready" for source in sources):
            raise HTTPException(409, "Wait for selected sources to finish indexing, or retry failed sources.")
    else:
        sources = []
    supplied = [source for source in sources if source.kind != "web"]
    existing_web = [source for source in sources if source.kind == "web"]
    for source in supplied:
        if source.status in {"pending", "processing"}:
            warnings.append(
                f'Supplied source "{source.title}" is still {source.status} and has not been used. '
                "Wait for indexing to finish in Sources."
            )
        elif source.status == "failed":
            warnings.append(
                f'Supplied source "{source.title}" failed to index: '
                f'{source.error or "Indexing failed."} Retry it in Sources.'
            )
    try:
        vectors, profile = embed_texts([query])
    except HTTPException as error:
        return {"evidence": [], "warnings": warnings + [str(error.detail)], "web_search_performed": False}
    stale_ids = outdated_source_ids(session, [source.id for source in supplied], profile)
    for source in supplied:
        if source.id in stale_ids:
            warnings.append(
                f'Supplied source "{source.title}" uses a different embedding profile and has not '
                "been used. Reindex it in Sources."
            )
    primary = ranked_chunks(session, supplied, vectors[0], profile)
    web = ranked_chunks(session, existing_web, vectors[0], profile)
    web_search_performed = supplement_web or not (primary or web)
    if web_search_performed:
        fetched, failures = web_sources(
            session, query, path_id, vector=vectors[0], profile=profile, source_ids=source_ids,
        )
        warnings.extend(failures)
        web = ranked_chunks(session, fetched + existing_web, vectors[0], profile)
    used = {item["id"] for item in primary}
    return {
        "evidence": primary + [item for item in web if item["id"] not in used],
        "warnings": warnings,
        "web_search_performed": web_search_performed,
    }
