import io
import json
import shutil
import socket
from pathlib import Path

import httpx
import openai
import pytest
from fastapi import HTTPException
from reportlab.pdfgen import canvas
from sqlmodel import select

from trellis import ai, evidence
from trellis.models import Chunk, LearningPath, Source


EVIDENCE = {
    "id": "chunk-one", "source_id": "source-one", "title": "Python documentation",
    "url": "https://docs.python.org/3/tutorial/", "excerpt": "The keyword def defines a function.",
    "location": "Article, character 1", "kind": "web",
}
CONTEXT = {"path_id": "path-one", "path_title": "Python", "node_title": "Functions"}


@pytest.fixture
def supported_answer(monkeypatch):
    monkeypatch.setattr(ai, "selected_provider", lambda session: ("azure", "test-model"))
    monkeypatch.setattr(evidence, "retrieve_evidence", lambda *args, **kwargs: {
        "evidence": [dict(EVIDENCE)], "warnings": [],
    })
    return ai.DraftAnswer(
        status="answered", blocks=[ai.AnswerBlock(text="Use `def` to define a function.", evidence_ids=["chunk-one"])],
        reason="",
    )


def test_no_evidence_abstains_without_model_call(monkeypatch):
    monkeypatch.setattr(ai, "selected_provider", lambda session: ("azure", "test-model"))
    monkeypatch.setattr(evidence, "retrieve_evidence", lambda *args, **kwargs: {
        "evidence": [], "warnings": ["Web search unavailable."],
    })
    monkeypatch.setattr(ai, "structured_completion", lambda *args: pytest.fail("Must not generate without evidence"))
    result = ai.answer(None, CONTEXT, "Explain functions")
    assert result["status"] == "abstained"
    assert result["evaluation"]["status"] == "evidence_unavailable"
    assert "Add a relevant document or URL" in result["content"]
    assert result["evaluation"]["retrieval_warnings"] == ["Web search unavailable."]


@pytest.mark.parametrize("citations", [[], ["invented-source"]])
def test_missing_or_invented_citations_are_withheld(monkeypatch, supported_answer, citations):
    supported_answer.blocks[0].evidence_ids = citations
    calls = []

    def complete(*args):
        calls.append(args)
        return supported_answer

    monkeypatch.setattr(ai, "structured_completion", complete)
    result = ai.answer(None, CONTEXT, "Explain functions")
    assert result["evaluation"]["status"] == "invalid_citations"
    assert "Use `def`" not in result["content"]
    assert len(calls) == 1


def test_supported_answer_records_exact_citations_and_evaluation(monkeypatch, supported_answer):
    results = iter([
        supported_answer,
        ai.Evaluation(relevance=1, completeness=0.8, consistency=1, grounding=1,
                      supported=True, explanation="The cited excerpt supports the claim."),
    ])
    monkeypatch.setattr(ai, "structured_completion", lambda *args: next(results))
    answer = ai.answer(None, CONTEXT, "How are functions defined?")
    assert answer["content"] == "Use `def` to define a function. [1]"
    assert answer["evidence"] == [EVIDENCE]
    assert answer["evaluation"]["completeness"] == 0.8
    assert answer["evaluation"]["citations_valid"] is True
    assert answer["evaluation"]["evaluated_at"]


def test_failed_correction_is_withheld_concisely(monkeypatch, supported_answer):
    internal_feedback = "Unsupported comparison in 851a8f96-7831-4ce2-aa5c-dad182fc51c5. " * 20
    results = iter([
        supported_answer,
        ai.Evaluation(relevance=1, completeness=1, consistency=0.1, grounding=0.1,
                      supported=False, explanation=internal_feedback),
        supported_answer,
        ai.Evaluation(relevance=1, completeness=1, consistency=1, grounding=0.89,
                      supported=True, explanation=internal_feedback),
    ])
    calls = []

    def complete(*args):
        calls.append(args)
        return next(results)

    monkeypatch.setattr(ai, "structured_completion", complete)
    result = ai.answer(None, CONTEXT, "Explain functions")
    assert result["evaluation"]["status"] == "low_grounding"
    assert "Use `def`" not in result["content"]
    assert "851a8f96" not in result["content"]
    assert len(result["content"]) < 180
    assert result["evaluation"]["explanation"] == internal_feedback
    assert result["evaluation"]["correction_attempted"] is True
    assert len(result["evaluation"]["checks"]) == 2
    assert len(calls) == 4


def test_one_correction_uses_same_evidence_and_passes_fresh_evaluation(monkeypatch, supported_answer):
    unsupported = supported_answer.model_copy(deep=True)
    unsupported.blocks[0].text += " Unlike classes, functions can only take one argument."
    feedback = "Remove the comparison with classes; the cited excerpt does not support it."
    results = iter([
        unsupported,
        ai.Evaluation(relevance=1, completeness=1, consistency=0.2, grounding=0.5,
                      supported=False, explanation=feedback),
        supported_answer,
        ai.Evaluation(relevance=1, completeness=1, consistency=1, grounding=1,
                      supported=True, explanation="Every remaining claim is supported."),
    ])
    calls = []

    def complete(provider, model, schema, messages):
        calls.append((schema, json.loads(messages[1]["content"])))
        return next(results)

    monkeypatch.setattr(ai, "structured_completion", complete)
    answer = ai.answer(None, CONTEXT, "How are functions defined?")
    assert answer["content"] == "Use `def` to define a function. [1]"
    assert answer["status"] == "answered"
    assert [schema for schema, _ in calls] == [ai.DraftAnswer, ai.Evaluation, ai.DraftAnswer, ai.Evaluation]
    assert calls[2][1]["previous_answer"] == unsupported.model_dump()
    assert calls[2][1]["evaluation_feedback"] == feedback
    assert calls[2][1]["evidence"] == calls[0][1]["evidence"] == [EVIDENCE]
    assert calls[3][1]["answer"] == supported_answer.model_dump()
    assert "evaluation_feedback" not in calls[3][1]
    assert answer["evaluation"]["correction_attempted"] is True
    assert [check["supported"] for check in answer["evaluation"]["checks"]] == [False, True]


def test_correction_provider_failure_still_withholds(monkeypatch, supported_answer):
    calls = []

    def complete(provider, model, schema, messages):
        calls.append(schema)
        if len(calls) == 1:
            return supported_answer
        if schema == ai.Evaluation:
            return ai.Evaluation(relevance=1, completeness=1, consistency=0.2, grounding=0.2,
                                 supported=False, explanation="Unsupported comparison.")
        raise HTTPException(503, "Correction provider unavailable.")

    monkeypatch.setattr(ai, "structured_completion", complete)
    result = ai.answer(None, CONTEXT, "Explain functions")
    assert result["status"] == "abstained"
    assert result["evaluation"]["status"] == "correction_failed"
    assert result["evaluation"]["correction_attempted"] is True
    assert "Use `def`" not in result["content"]
    assert calls == [ai.DraftAnswer, ai.Evaluation, ai.DraftAnswer]


def test_corrected_draft_must_still_pass_citation_membership(monkeypatch, supported_answer):
    invalid = supported_answer.model_copy(deep=True)
    invalid.blocks[0].evidence_ids = ["invented-after-correction"]
    results = iter([
        supported_answer,
        ai.Evaluation(relevance=1, completeness=1, consistency=0.2, grounding=0.2,
                      supported=False, explanation="Unsupported comparison."),
        invalid,
    ])
    monkeypatch.setattr(ai, "structured_completion", lambda *args: next(results))
    result = ai.answer(None, CONTEXT, "Explain functions")
    assert result["evaluation"]["status"] == "invalid_citations"
    assert result["evaluation"]["correction_attempted"] is True
    assert len(result["evaluation"]["checks"]) == 1
    assert "invented-after-correction" not in result["content"]


def test_evaluation_outage_withholds_candidate(monkeypatch, supported_answer):
    def complete(provider, model, schema, messages):
        if schema == ai.DraftAnswer:
            return supported_answer
        raise HTTPException(503, "Evaluation provider unavailable.")

    monkeypatch.setattr(ai, "structured_completion", complete)
    result = ai.answer(None, CONTEXT, "Explain functions")
    assert result["evaluation"]["status"] == "evaluation_failed"
    assert "Use `def`" not in result["content"]
    assert result["evaluation"]["correction_attempted"] is False
    assert result["content"] == "I couldn't complete the evidence check. Please try again."


def test_nested_curriculum_derives_valid_parent_references(monkeypatch):
    monkeypatch.setattr(ai, "selected_provider", lambda session: ("azure", "test-model"))
    curriculum = ai.Curriculum(
        title="Python", description="A course", nodes=[ai.CurriculumNode(
            title="Functions", description="Functions", evidence_ids=[], children=[ai.CurriculumNode(
                title="Parameters", description="Parameters", evidence_ids=[], children=[ai.CurriculumNode(
                    title="Defaults", description="Defaults", evidence_ids=[], children=[],
                )],
            )],
        )],
    )
    results = iter([
        curriculum,
        ai.Evaluation(relevance=1, completeness=1, consistency=1, grounding=1,
                      supported=True, explanation="The outline is faithfully represented."),
    ])
    monkeypatch.setattr(ai, "structured_completion", lambda *args: next(results))
    monkeypatch.setattr(evidence, "retrieve_evidence", lambda *args, **kwargs: pytest.fail("Outline imports use the supplied outline"))
    result = ai.generate_curriculum(None, "Functions\n  Parameters\n    Defaults", "outline", [])
    assert [node["parent_index"] for node in result["nodes"]] == [None, 0, 1]
    assert [node["title"] for node in result["nodes"]] == ["Functions", "Parameters", "Defaults"]
    assert all(node["evidence_ids"] == [] for node in result["nodes"])
    assert result["generation"]["mode"] == "outline"
    assert result["generation"]["evidence"] == []
    assert result["generation"]["evaluation"]["method"] == "model_outline_fidelity"


@pytest.mark.parametrize("evidence_ids", [[], ["invented-curriculum-reference"]])
def test_goal_curriculum_requires_valid_citations_for_every_node(monkeypatch, supported_answer, evidence_ids):
    calls = []

    def complete(*args):
        calls.append(args)
        return ai.Curriculum(title="Functions", description="A course", nodes=[ai.CurriculumNode(
            title="Definitions", description="Define functions", evidence_ids=evidence_ids, children=[],
        )])

    monkeypatch.setattr(ai, "structured_completion", complete)
    with pytest.raises(HTTPException) as error:
        ai.generate_curriculum(None, "Learn function definitions", "goal", [])
    assert error.value.status_code == 502
    assert "valid source references" in error.value.detail
    assert len(calls) == 1


def test_goal_curriculum_returns_exact_provenance_after_support_check(monkeypatch, supported_answer):
    results = iter([
        ai.Curriculum(title="Functions", description="Learn definitions", nodes=[ai.CurriculumNode(
            title="Definitions", description="Define functions", evidence_ids=["chunk-one"], children=[],
        )]),
        ai.Evaluation(relevance=1, completeness=1, consistency=1, grounding=1,
                      supported=True, explanation="The cited excerpt supports each topic."),
    ])
    calls = []

    def complete(provider, model, schema, messages):
        calls.append((schema, json.loads(messages[1]["content"])))
        return next(results)

    monkeypatch.setattr(ai, "structured_completion", complete)
    result = ai.generate_curriculum(None, "Learn function definitions", "goal", [])
    assert result["nodes"][0]["evidence_ids"] == ["chunk-one"]
    assert result["generation"]["provider"] == "azure"
    assert result["generation"]["model"] == "test-model"
    assert result["generation"]["evidence"] == [EVIDENCE]
    assert result["generation"]["title"] == result["title"]
    assert result["generation"]["description"] == result["description"]
    assert result["generation"]["nodes"] == result["nodes"]
    assert result["generation"]["evaluation"]["status"] == "passed"
    assert result["generation"]["created_at"]
    assert [schema for schema, _ in calls] == [ai.Curriculum, ai.Evaluation]
    assert calls[1][1]["curriculum"]["nodes"][0]["evidence_ids"] == ["chunk-one"]


def test_goal_curriculum_rejects_unsupported_topics_despite_valid_ids(monkeypatch, supported_answer):
    results = iter([
        ai.Curriculum(title="Functions", description="A course", nodes=[ai.CurriculumNode(
            title="Quantum functions", description="Invented topic", evidence_ids=["chunk-one"], children=[],
        )]),
        ai.Evaluation(relevance=1, completeness=1, consistency=0.1, grounding=0.1,
                      supported=False, explanation="The cited excerpt does not support this topic."),
    ])
    monkeypatch.setattr(ai, "structured_completion", lambda *args: next(results))
    with pytest.raises(HTTPException) as error:
        ai.generate_curriculum(None, "Learn function definitions", "goal", [])
    assert "not sufficiently supported" in error.value.detail


@pytest.mark.parametrize("supported,completeness", [(False, 1), (True, 0.8)])
def test_outline_import_rejects_invented_or_omitted_topics(monkeypatch, supported_answer, supported, completeness):
    results = iter([
        ai.Curriculum(title="Functions", description="A course", nodes=[ai.CurriculumNode(
            title="Definitions", description="Define functions", evidence_ids=[], children=[],
        )]),
        ai.Evaluation(relevance=1, completeness=completeness, consistency=1, grounding=1,
                      supported=supported, explanation="The original outline was not preserved."),
    ])
    monkeypatch.setattr(ai, "structured_completion", lambda *args: next(results))
    monkeypatch.setattr(evidence, "retrieve_evidence", lambda *args, **kwargs: pytest.fail("No web for outline imports"))
    with pytest.raises(HTTPException) as error:
        ai.generate_curriculum(None, "Functions\nParameters\nReturn values", "outline", [])
    assert "faithfully preserve" in error.value.detail


def test_insufficient_cached_web_triggers_fresh_research(monkeypatch, supported_answer):
    calls = []
    new_evidence = {**EVIDENCE, "id": "new-chunk", "title": "Freshly fetched documentation"}

    def retrieve(*args, **kwargs):
        calls.append(kwargs)
        if kwargs.get("supplement_web"):
            return {"evidence": [new_evidence], "warnings": ["One web page was unavailable."]}
        return {"evidence": [dict(EVIDENCE)], "warnings": []}

    supported_answer.blocks[0].evidence_ids = ["new-chunk"]
    completions = iter([
        ai.DraftAnswer(status="insufficient", blocks=[], reason="The cached source is incomplete."),
        supported_answer,
        ai.Evaluation(relevance=1, completeness=1, consistency=1, grounding=1,
                      supported=True, explanation="The new excerpt supports the answer."),
    ])
    monkeypatch.setattr(evidence, "retrieve_evidence", retrieve)
    monkeypatch.setattr(ai, "structured_completion", lambda *args: next(completions))
    result = ai.answer(None, CONTEXT, "Explain functions")
    assert result["status"] == "answered"
    assert calls[1]["supplement_web"] is True
    assert result["evidence"] == [new_evidence]
    assert result["evaluation"]["retrieval_warnings"] == ["One web page was unavailable."]


@pytest.mark.parametrize("provider", ["azure", "openai", "openrouter", "ollama"])
def test_all_provider_requests_use_selected_model_and_expected_endpoint(monkeypatch, provider):
    from trellis.config import settings
    from trellis.provider_routes import ConnectionCheck

    monkeypatch.setattr(settings, "azure_openai_endpoint", "https://azure.example")
    monkeypatch.setattr(settings, "azure_openai_api_key", "azure-secret")
    monkeypatch.setattr(settings, "openai_api_key", "openai-secret")
    monkeypatch.setattr(settings, "openrouter_api_key", "router-secret")
    monkeypatch.setattr(settings, "openai_base_url", "https://openai.example/v1")
    monkeypatch.setattr(settings, "openrouter_base_url", "https://router.example/api/v1")
    monkeypatch.setattr(settings, "ollama_base_url", "http://localhost:11434/v1")
    requests = []

    def respond(request):
        requests.append(request)
        return httpx.Response(200, json={
            "id": "test", "object": "chat.completion", "created": 1, "model": "chosen-model",
            "choices": [{"index": 0, "finish_reason": "stop", "message": {
                "role": "assistant", "content": '{"status":"ready"}',
            }}],
        })

    real_openai, real_azure = ai.OpenAI, ai.AzureOpenAI
    monkeypatch.setattr(ai, "OpenAI", lambda **kwargs: real_openai(
        **kwargs, http_client=httpx.Client(transport=httpx.MockTransport(respond)),
    ))
    monkeypatch.setattr(ai, "AzureOpenAI", lambda **kwargs: real_azure(
        **kwargs, http_client=httpx.Client(transport=httpx.MockTransport(respond)),
    ))
    result = ai.structured_completion(provider, "chosen-model", ConnectionCheck, [
        {"role": "user", "content": "Return ready."},
    ])
    assert result.status == "ready"
    payload = json.loads(requests[0].content)
    assert payload["model"] == "chosen-model"
    assert payload["response_format"]["json_schema"]["strict"] is True
    assert requests[0].url.host == {
        "azure": "azure.example", "openai": "openai.example",
        "openrouter": "router.example", "ollama": "localhost",
    }[provider]
    if provider == "azure":
        assert "/deployments/chosen-model/" in requests[0].url.path
        assert requests[0].headers["api-key"] == "azure-secret"


def test_settings_persist_model_without_revealing_credentials(client, monkeypatch):
    from trellis.config import settings

    monkeypatch.setattr(settings, "azure_openai_api_key", "do-not-return-this-secret")
    response = client.put("/api/settings", json={"provider": "azure", "model": "chosen-deployment"})
    assert response.status_code == 200
    current = client.get("/api/settings")
    assert current.json()["model"] == "chosen-deployment"
    assert "do-not-return-this-secret" not in current.text
    ollama = next(item for item in current.json()["providers"] if item["id"] == "ollama")
    assert ":11434/" in ollama["base_url"]


def test_provider_error_never_exposes_remote_body():
    error = openai.BadRequestError(
        "SECRET_API_KEY and private prompt", response=httpx.Response(
            400, request=httpx.Request("POST", "https://example.com"),
        ), body={"secret": "SECRET_API_KEY"},
    )
    mapped = ai.provider_error(error)
    assert "SECRET_API_KEY" not in mapped.detail
    assert "structured JSON" in mapped.detail


def test_private_urls_are_rejected(monkeypatch):
    monkeypatch.setattr(socket, "getaddrinfo", lambda *args, **kwargs: [
        (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("127.0.0.1", 443)),
    ])
    for url in ("http://localhost", "http://127.0.0.1", "http://private.example"):
        with pytest.raises(HTTPException) as error:
            evidence.public_url(url)
        assert error.value.status_code == 422


def test_fetch_pins_dns_and_blocks_private_redirect(monkeypatch):
    def resolve(host, *args, **kwargs):
        address = "127.0.0.1" if host == "127.0.0.1" else "93.184.215.14"
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (address, 443))]

    seen = []

    def respond(request):
        seen.append(request)
        return httpx.Response(302, headers={"Location": "http://127.0.0.1/secrets"})

    monkeypatch.setattr(socket, "getaddrinfo", resolve)
    client = httpx.Client(transport=httpx.MockTransport(respond))
    monkeypatch.setattr(evidence.httpx, "Client", lambda **kwargs: client)
    with pytest.raises(HTTPException):
        evidence.fetch_document("https://example.com/article")
    assert len(seen) == 1
    assert seen[0].url.host == "93.184.215.14"
    assert seen[0].headers["Host"] == "example.com"
    assert seen[0].extensions["sni_hostname"] == "example.com"


def test_pdf_parser_preserves_page_locations(tmp_path, monkeypatch):
    from trellis.config import settings

    monkeypatch.setattr(settings, "data_dir", tmp_path)
    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer)
    pdf.drawString(72, 720, "Functions use the def keyword.")
    pdf.showPage()
    pdf.drawString(72, 720, "Return statements provide a result.")
    pdf.save()
    (tmp_path / "sources").mkdir()
    path = tmp_path / "sources" / "course.pdf"
    path.write_bytes(buffer.getvalue())
    sections = evidence.document_sections(Source(title="Course", kind="upload", file_path=str(path)))
    assert sections[0][1] == "Page 1"
    assert "def keyword" in sections[0][0]
    assert sections[1][1] == "Page 2"


def test_indexing_failure_preserves_prior_chunks(session, monkeypatch):
    source = Source(title="Notes", kind="text", content="Functions use def.", status="ready", chunk_count=1)
    session.add(source)
    session.commit()
    prior = Chunk(source_id=source.id, content="Previous excerpt", profile="old:2", embedding=[1, 0])
    session.add(prior)
    session.commit()

    def fail(*args):
        raise HTTPException(503, "Embedding provider unavailable.")

    monkeypatch.setattr(evidence, "embed_texts", fail)
    evidence.index_source(session, source)
    session.refresh(source)
    assert source.status == "failed"
    assert source.error == "Embedding provider unavailable."
    assert session.get(Chunk, prior.id).content == "Previous excerpt"


def test_retrieval_is_path_scoped_and_filters_embedding_profiles(session, monkeypatch):
    path = LearningPath(title="Python", input="Python")
    other_path = LearningPath(title="Private other course", input="Other")
    session.add_all([path, other_path])
    session.commit()
    supplied = Source(path_id=path.id, title="My course", kind="text", status="ready")
    other = Source(path_id=other_path.id, title="Other course", kind="text", status="ready")
    old = Source(path_id=path.id, title="Old embedding", kind="text", status="ready")
    web = Source(path_id=path.id, title="Web course", kind="web", status="ready")
    session.add_all([supplied, other, old, web])
    session.commit()
    session.add_all([
        Chunk(source_id=supplied.id, content="Supplied Python functions", profile="test:3", embedding=[1, 0.1, 0]),
        Chunk(source_id=other.id, content="Secret other-path content", profile="test:3", embedding=[1, 0, 0]),
        Chunk(source_id=old.id, content="Wrong dimensions", profile="old:2", embedding=[1, 0]),
        Chunk(source_id=web.id, content="Web functions", profile="test:3", embedding=[1, 0, 0]),
    ])
    session.commit()
    monkeypatch.setattr(evidence, "embed_texts", lambda texts: ([[1, 0, 0]], "test:3"))
    monkeypatch.setattr(evidence, "web_sources", lambda *args: pytest.fail("Supplied source has priority"))
    result = evidence.retrieve_evidence(session, "Python functions", path_id=path.id)
    assert [item["source_id"] for item in result["evidence"]] == [supplied.id]
    assert result["evidence"][0]["excerpt"] == "Supplied Python functions"


def test_preferred_source_problems_are_named_when_web_evidence_is_used(session, monkeypatch):
    path = LearningPath(title="Functions", input="Functions")
    session.add(path)
    session.commit()
    pending = Source(path_id=path.id, title="Uploaded outline", kind="upload", status="pending")
    processing = Source(path_id=path.id, title="Course handbook", kind="upload", status="processing")
    failed = Source(path_id=path.id, title="Scanned notes", kind="upload", status="failed",
                    error="No extractable text was found.")
    stale = Source(path_id=path.id, title="Old course notes", kind="text", status="ready")
    web = Source(path_id=path.id, title="Web documentation", kind="web", status="ready")
    session.add_all([pending, processing, failed, stale, web])
    session.commit()
    session.add_all([
        Chunk(source_id=stale.id, content="Old notes", profile="old:2", embedding=[1, 0]),
        Chunk(source_id=web.id, content="Functions use def.", profile="test:3", embedding=[1, 0, 0]),
    ])
    session.commit()
    monkeypatch.setattr(evidence, "embed_texts", lambda texts: ([[1, 0, 0]], "test:3"))
    monkeypatch.setattr(evidence, "web_sources", lambda *args: pytest.fail("Cached web evidence is available"))
    result = evidence.retrieve_evidence(session, "Functions", path_id=path.id)
    warnings = " ".join(result["warnings"])
    assert '"Uploaded outline" is still pending' in warnings
    assert '"Course handbook" is still processing' in warnings
    assert '"Scanned notes" failed to index' in warnings
    assert "No extractable text" in warnings
    assert '"Old course notes" uses a different embedding profile' in warnings
    assert "uses web sources" in warnings
    assert [item["source_id"] for item in result["evidence"]] == [web.id]


def test_source_list_and_detail_report_reindex_needed_until_reindexed(client, session, monkeypatch):
    source = Source(title="Course notes", kind="text", content="Functions use def.", status="ready", chunk_count=1)
    session.add(source)
    session.commit()
    session.add(Chunk(source_id=source.id, content=source.content, profile="old:2", embedding=[1, 0]))
    session.commit()
    monkeypatch.setattr(ai, "embedding_profile", lambda: ("fixture", "model", 3, "test:3"))
    monkeypatch.setattr(evidence, "embed_texts", lambda texts: ([[1, 0, 0] for _ in texts], "test:3"))
    assert client.get("/api/sources").json()[0]["needs_reindex"] is True
    assert client.get(f"/api/sources/{source.id}").json()["needs_reindex"] is True
    assert client.post(f"/api/sources/{source.id}/retry").status_code == 202
    session.expire_all()
    assert client.get("/api/sources").json()[0]["needs_reindex"] is False
    assert client.get(f"/api/sources/{source.id}").json()["needs_reindex"] is False


def test_recovery_indexes_interrupted_sources(db_engine, session, monkeypatch):
    source = Source(title="Recovered", kind="text", content="Functions use def.", status="processing")
    session.add(source)
    session.commit()
    monkeypatch.setattr(evidence, "engine", db_engine)
    monkeypatch.setattr(evidence, "embed_texts", lambda texts: ([[1, 0, 0] for _ in texts], "test:3"))
    evidence.recover_pending_sources()
    session.refresh(source)
    assert source.status == "ready"
    assert source.chunk_count == 1


def test_source_api_indexes_real_parser_output(client, monkeypatch):
    monkeypatch.setattr(evidence, "embed_texts", lambda texts: ([[1, 0, 0] for _ in texts], "test:3"))
    response = client.post("/api/sources/upload", files={
        "file": ("guide.md", b"# Python\n\nFunctions use def.\n", "text/markdown"),
    })
    assert response.status_code == 202
    source_id = response.json()["id"]
    detail = client.get(f"/api/sources/{source_id}").json()
    assert detail["status"] == "ready"
    assert "Functions use def" in detail["excerpts"][0]["excerpt"]
    assert "file_path" not in detail
    assert "content" not in detail
    assert client.delete(f"/api/sources/{source_id}").status_code == 204


@pytest.mark.parametrize("legacy_absolute_path", [False, True])
def test_uploaded_source_reindexes_and_deletes_after_data_directory_relocation(
    client, session, monkeypatch, tmp_path, legacy_absolute_path,
):
    from trellis.config import settings

    monkeypatch.setattr(evidence, "embed_texts", lambda texts: ([[1, 0, 0] for _ in texts], "test:3"))
    response = client.post("/api/sources/upload", files={
        "file": ("guide.md", b"Functions use def.", "text/markdown"),
    })
    assert response.status_code == 202
    source_id = response.json()["id"]
    source = session.get(Source, source_id)
    assert source.file_path == f"sources/{source_id}.md"
    original_file = settings.data_dir / source.file_path
    relocated_directory = tmp_path / "relocated"
    (relocated_directory / "sources").mkdir(parents=True)
    relocated_file = relocated_directory / "sources" / Path(source.file_path).name
    shutil.copyfile(original_file, relocated_file)
    original_file.write_text("Old absolute location must not be read or deleted.")
    if legacy_absolute_path:
        source.file_path = str(original_file)
        session.add(source)
        session.commit()
    monkeypatch.setattr(settings, "data_dir", relocated_directory)

    assert client.post(f"/api/sources/{source_id}/retry").status_code == 202
    session.expire_all()
    detail = client.get(f"/api/sources/{source_id}").json()
    assert detail["status"] == "ready"
    assert detail["excerpts"][0]["excerpt"] == "Functions use def."
    assert client.delete(f"/api/sources/{source_id}").status_code == 204
    assert not relocated_file.exists()
    assert original_file.exists()


def test_unattached_retrieval_cannot_select_another_paths_sources(session, monkeypatch):
    path = LearningPath(title="Private course", input="Private")
    session.add(path)
    session.commit()
    source = Source(path_id=path.id, title="Private", kind="text", status="ready")
    session.add(source)
    session.commit()
    with pytest.raises(HTTPException) as error:
        evidence.retrieve_evidence(session, "Python", source_ids=[source.id])
    assert error.value.status_code == 409
    assert session.exec(select(Chunk)).all() == []
