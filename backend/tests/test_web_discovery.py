import httpx
import pytest
from fastapi import HTTPException
from sqlmodel import select

from trellis import evidence
from trellis.models import Chunk, LearningPath, Source


@pytest.fixture
def search_fixture(monkeypatch):
    results = []
    documents = {}
    searches = []
    downloads = []

    class Search:
        def __init__(self, **kwargs):
            pass

        def text(self, query, **kwargs):
            searches.append(query)
            return results

    def fetch(url):
        downloads.append(url)
        document = documents[url]
        if isinstance(document, Exception):
            raise document
        text, final_url = document
        return text.encode(), "text/plain", final_url

    def embed(texts):
        return [([0, 1, 0] if text.startswith("Unrelated") else [1, 0, 0]) for text in texts], "test:3"

    monkeypatch.setattr(evidence, "DDGS", Search)
    monkeypatch.setattr(evidence, "public_url", lambda url: (httpx.URL(url), "93.184.216.34"))
    monkeypatch.setattr(evidence, "fetch_document", fetch)
    monkeypatch.setattr(evidence, "embed_texts", embed)
    return results, documents, searches, downloads


def add_source(session, path_id, *, kind="web", url=None, text="Supported cached passage", profile="test:3"):
    source = Source(path_id=path_id, title="Cached documentation", kind=kind,
                    url=url, status="ready", content=text, chunk_count=1)
    session.add(source)
    session.commit()
    session.add(Chunk(source_id=source.id, content=text, profile=profile, embedding=[1, 0, 0]))
    session.commit()
    session.refresh(source)
    return source


def test_cached_supplied_and_web_passages_are_reused_in_priority_order(session, search_fixture):
    path = LearningPath(title="Caching", input="Caching")
    other_path = LearningPath(title="Other journey", input="Other")
    session.add_all([path, other_path])
    session.commit()
    supplied = add_source(session, path.id, kind="url", text="Your supplied material")
    saved_web = add_source(session, path.id, text="Previously discovered relevant material")
    add_source(session, other_path.id, text="Another journey's material")
    add_source(session, None, text="An unattached source")
    add_source(session, path.id, text="An outdated embedding", profile="old:3")

    result = evidence.retrieve_evidence(session, "Explain cache-aside", path_id=path.id)

    assert [item["source_id"] for item in result["evidence"]] == [supplied.id, saved_web.id]
    assert result["warnings"] == []
    assert result["web_search_performed"] is False
    assert search_fixture[2] == []


def test_gap_search_adds_relevant_pages_and_later_questions_reuse_them(session, search_fixture):
    results, documents, searches, downloads = search_fixture
    path = LearningPath(title="Caching", input="Caching")
    session.add(path)
    session.commit()
    supplied = add_source(session, path.id, kind="text", text="Cache-aside documentation")
    url = "https://example.org/write-through"
    results.append({"href": url, "title": "Write-through documentation", "body": "Untrusted search snippet"})
    documents[url] = ("Write-through updates both the cache and its backing store.", url)

    result = evidence.retrieve_evidence(session, "How write-through updates data", path_id=path.id, supplement_web=True)

    assert searches == ["How write-through updates data"]
    assert downloads == [url]
    assert result["web_search_performed"] is True
    assert result["evidence"][0]["source_id"] == supplied.id
    discovered = result["evidence"][1]
    assert discovered["excerpt"] == documents[url][0]
    assert discovered["kind"] == "web"
    saved = session.get(Source, discovered["source_id"])
    assert saved.path_id == path.id
    assert saved.status == "ready"
    assert saved.chunk_count == 1

    repeated = evidence.retrieve_evidence(session, "Compare cache-aside and write-through", path_id=path.id)
    assert [item["source_id"] for item in repeated["evidence"]] == [supplied.id, saved.id]
    assert repeated["web_search_performed"] is False
    assert len(searches) == len(downloads) == 1


def test_only_three_relevant_readable_pages_are_persisted(session, search_fixture):
    results, documents, searches, downloads = search_fixture
    path = LearningPath(title="Caching", input="Caching")
    session.add(path)
    session.commit()
    for slug, content in [
        ("irrelevant", "Unrelated gardening information"),
        ("broken", HTTPException(422, "No readable article text was found at this URL.")),
        ("one", "Relevant first source"),
        ("two", "Relevant second source"),
        ("three", "Relevant third source"),
        ("four", "Relevant fourth source"),
    ]:
        url = f"https://example.org/{slug}"
        results.append({"href": url, "title": "Highly relevant search snippet"})
        documents[url] = content if isinstance(content, Exception) else (content, url)

    result = evidence.retrieve_evidence(session, "Explain caching", path_id=path.id)

    assert result["web_search_performed"] is True
    assert len(searches) == 1
    assert len(downloads) == 5
    sources = session.exec(select(Source)).all()
    assert {source.url for source in sources} == {
        "https://example.org/one", "https://example.org/two", "https://example.org/three",
    }
    assert len(session.exec(select(Chunk)).all()) == 3
    assert len(result["evidence"]) == 3
    assert "No readable article text" in result["warnings"][0]


def test_search_duplicates_and_redirects_reuse_manual_sources_without_changing_them(session, search_fixture):
    results, documents, _, downloads = search_fixture
    path = LearningPath(title="Caching", input="Caching")
    session.add(path)
    session.commit()
    original_url = "https://example.org/cache"
    supplied = add_source(session, path.id, kind="url", url=original_url, text="Your supplied cache reference")
    original = supplied.model_dump()
    redirect_url = "https://example.org/old-cache"
    results.extend([
        {"href": original_url + "#overview"},
        {"href": original_url},
        {"href": redirect_url},
        {"href": redirect_url},
    ])
    documents[redirect_url] = ("The newly fetched redirect must not replace supplied material.", original_url)

    result = evidence.retrieve_evidence(session, "Explain caching", path_id=path.id, supplement_web=True)

    assert [item["source_id"] for item in result["evidence"]] == [supplied.id]
    assert downloads == [redirect_url]
    assert len(session.exec(select(Source)).all()) == 1
    assert len(session.exec(select(Chunk)).all()) == 1
    session.refresh(supplied)
    assert supplied.model_dump() == original


def test_duplicate_new_search_results_save_one_source(session, search_fixture):
    results, documents, _, downloads = search_fixture
    url = "https://example.org/cache"
    alias = "https://example.org/cache-alias"
    results.extend([{"href": url}, {"href": url + "#overview"}, {"href": alias}])
    documents[url] = ("Cache reference", url)
    documents[alias] = ("Cache reference", url)

    result = evidence.retrieve_evidence(session, "Explain caching")

    assert len(result["evidence"]) == 1
    assert len(session.exec(select(Source)).all()) == 1
    assert len(session.exec(select(Chunk)).all()) == 1
    assert downloads == [url, alias]


def test_cached_search_hits_do_not_exhaust_the_new_source_budget(session, search_fixture):
    results, documents, _, downloads = search_fixture
    path = LearningPath(title="Caching", input="Caching")
    session.add(path)
    session.commit()
    for index in range(3):
        url = f"https://example.org/cached-{index}"
        add_source(session, path.id, url=url)
        results.append({"href": url})
    missing_url = "https://example.org/missing-concept"
    results.append({"href": missing_url})
    documents[missing_url] = ("The missing detail about write-through caching", missing_url)

    result = evidence.retrieve_evidence(session, "Explain write-through", path_id=path.id, supplement_web=True)

    assert downloads == [missing_url]
    assert missing_url in {item["url"] for item in result["evidence"]}
    assert len(session.exec(select(Source)).all()) == 4


def test_new_journey_never_reuses_unselected_manual_source_content(session, search_fixture):
    results, documents, _, _ = search_fixture
    url = "https://example.org/cache"
    unrelated = add_source(session, None, kind="url", url=url, text="Unselected stored material")
    results.append({"href": url})
    documents[url] = ("Freshly fetched public cache documentation", url)

    result = evidence.retrieve_evidence(session, "Explain caching")

    assert len(result["evidence"]) == 1
    assert result["evidence"][0]["source_id"] != unrelated.id
    assert result["evidence"][0]["excerpt"] == documents[url][0]
    assert session.get(Source, unrelated.id).content == "Unselected stored material"


def test_discovery_does_not_reuse_another_journeys_source(session, search_fixture):
    results, documents, _, _ = search_fixture
    path = LearningPath(title="Caching", input="Caching")
    other_path = LearningPath(title="Other journey", input="Other")
    session.add_all([path, other_path])
    session.commit()
    url = "https://example.org/cache"
    other_source = add_source(session, other_path.id, url=url, text="Other journey's snapshot")
    results.append({"href": url})
    documents[url] = ("Freshly fetched cache documentation", url)

    result = evidence.retrieve_evidence(session, "Explain caching", path_id=path.id)

    saved = session.get(Source, result["evidence"][0]["source_id"])
    assert saved.id != other_source.id
    assert saved.path_id == path.id
    assert session.get(Source, other_source.id).path_id == other_path.id


def test_failed_existing_source_is_not_reindexed_by_discovery(session, search_fixture):
    results, _, _, downloads = search_fixture
    path = LearningPath(title="Caching", input="Caching")
    session.add(path)
    session.commit()
    url = "https://example.org/cache"
    failed = Source(path_id=path.id, title="Manually added source", kind="url", url=url,
                    status="failed", error="Original failure")
    session.add(failed)
    session.commit()
    results.append({"href": url})

    result = evidence.retrieve_evidence(session, "Explain caching", path_id=path.id)

    assert result["evidence"] == []
    assert result["web_search_performed"] is True
    assert downloads == []
    session.refresh(failed)
    assert failed.status == "failed"
    assert failed.error == "Original failure"


def test_discovery_filters_mismatched_embedding_profile(session, search_fixture, monkeypatch):
    results, documents, _, _ = search_fixture
    url = "https://example.org/cache"
    results.append({"href": url})
    documents[url] = ("Cache documentation", url)
    vectors = iter([([[1, 0, 0]], "test:3"), ([[1, 0]], "changed:2")])
    monkeypatch.setattr(evidence, "embed_texts", lambda texts: next(vectors))

    result = evidence.retrieve_evidence(session, "Explain caching")

    assert result["evidence"] == []
    assert session.exec(select(Source)).all() == []
    assert session.exec(select(Chunk)).all() == []


def test_search_failure_counts_as_one_search_attempt(session, search_fixture, monkeypatch):
    class UnavailableSearch:
        def __init__(self, **kwargs):
            raise RuntimeError("Search unavailable")

    monkeypatch.setattr(evidence, "DDGS", UnavailableSearch)

    result = evidence.retrieve_evidence(session, "Explain caching")

    assert result["evidence"] == []
    assert result["web_search_performed"] is True
    assert "Web search is unavailable" in result["warnings"][0]


def test_embedding_failure_does_not_claim_search_was_attempted(session, search_fixture, monkeypatch):
    def unavailable(texts):
        raise HTTPException(503, "Embedding provider unavailable")

    monkeypatch.setattr(evidence, "embed_texts", unavailable)

    result = evidence.retrieve_evidence(session, "Explain caching")

    assert result["evidence"] == []
    assert result["web_search_performed"] is False
    assert search_fixture[2] == []
