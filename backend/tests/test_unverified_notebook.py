from copy import deepcopy
from io import BytesIO

from pypdf import PdfReader
import pytest

from trellis.models import ExportRecord, Interaction, LearningPath, Node, Thread


@pytest.fixture
def unverified_response(session):
    path = LearningPath(title="System design", input="Learn system design")
    session.add(path)
    session.flush()
    node = Node(path_id=path.id, title="Horizontal scaling")
    session.add(node)
    session.flush()
    thread = Thread(path_id=path.id, node_id=node.id, title="QPS")
    session.add(thread)
    session.flush()
    response = Interaction(
        path_id=path.id, node_id=node.id, thread_id=thread.id,
        prompt="Explain more", content="QPS means **queries per second**.",
        status="unverified", provider="test", model="test", evidence=[],
        evaluation={
            "status": "unverified", "method": "model_knowledge",
            "explanation": "I could not find sufficient supporting sources. This explanation "
                           "uses the model’s general knowledge and may contain inaccuracies.",
        },
    )
    session.add(response)
    session.commit()
    return response


def test_unverified_provenance_survives_notebook_edits_and_study_export(
    client, session, unverified_response,
):
    response = unverified_response
    page = client.post("/api/notebook/pages", json={
        "path_id": response.path_id, "title": "Concepts",
    }).json()
    destination = client.post("/api/notebook/pages", json={
        "path_id": response.path_id, "title": "Revision",
    }).json()
    saved_result = client.post("/api/notebook/items", json={
        "page_id": page["id"], "interaction_id": response.id,
    })
    assert saved_result.status_code == 201
    saved = saved_result.json()
    origin = deepcopy(saved["origin"])
    assert saved["kind"] == "response"
    assert saved["evidence"] == []
    assert origin["status"] == "unverified"
    assert origin["evaluation"] == response.evaluation
    assert origin["thread_title"] == "QPS"

    updated = client.patch(f'/api/notebook/items/{saved["id"]}', json={
        "page_id": destination["id"], "title": "My QPS summary",
        "content": "A measure of query throughput.",
    })
    assert updated.status_code == 200
    assert updated.json()["origin"] == origin
    assert updated.json()["evidence"] == []
    assert updated.json()["kind"] == "response"

    # The saved provenance does not depend on the current interaction record.
    response.status = "answered"
    response.evaluation = {"status": "scored"}
    session.add(response)
    session.commit()
    reopened = client.get("/api/notebook/pages", params={"path_id": response.path_id}).json()
    note = next(item for section in reopened for item in section["items"])
    assert note["page_id"] == destination["id"]
    assert note["origin"] == origin
    assert note["evidence"] == []

    study = client.post("/api/study-sessions", json={
        "path_id": response.path_id, "title": "Throughput revision", "item_ids": [saved["id"]],
    }).json()
    studies = client.get("/api/study-sessions", params={"path_id": response.path_id}).json()
    assert studies[0]["item_ids"] == [saved["id"]]
    exported = client.post("/api/exports", json={
        "path_id": response.path_id, "title": "QPS study notes",
        "item_ids": study["item_ids"], "study_session_id": study["id"],
    })
    assert exported.status_code == 201
    metadata = exported.json()
    assert metadata["status"] == "completed", metadata
    record = session.get(ExportRecord, metadata["id"])
    assert record.snapshot[0]["origin"] == origin
    assert record.snapshot[0]["evidence"] == []
    frozen_snapshot = deepcopy(record.snapshot)

    download = client.get(metadata["download_url"])
    assert download.status_code == 200
    text = "\n".join(page.extract_text() for page in PdfReader(BytesIO(download.content)).pages)
    text = " ".join(text.split())
    assert "General AI knowledge — not verified against sources" in text
    assert "may contain inaccuracies" in text
    assert "My QPS summary" in text
    assert "A measure of query throughput." in text
    assert "Exploration: QPS" in text
    assert "[1]" not in text
    assert "Sources" not in text

    client.patch(f'/api/notebook/items/{saved["id"]}', json={"content": "Changed after export"})
    session.refresh(record)
    assert record.snapshot == frozen_snapshot
    assert client.get(metadata["download_url"]).content == download.content


def test_unverified_response_remains_scoped_and_origin_cannot_be_overwritten(
    client, session, unverified_response,
):
    response = unverified_response
    other_path = LearningPath(title="Unrelated journey", input="Another topic")
    session.add(other_path)
    session.commit()
    page = client.post("/api/notebook/pages", json={
        "path_id": response.path_id, "title": "Concepts",
    }).json()
    other_page = client.post("/api/notebook/pages", json={
        "path_id": other_path.id, "title": "Other notebook",
    }).json()
    assert client.post("/api/notebook/items", json={
        "page_id": other_page["id"], "interaction_id": response.id,
    }).status_code == 422
    assert client.post("/api/notebook/items", json={
        "page_id": page["id"], "interaction_id": response.id, "evidence_id": "invented",
    }).status_code == 422
    saved = client.post("/api/notebook/items", json={
        "page_id": page["id"], "interaction_id": response.id,
    }).json()
    assert client.patch(f'/api/notebook/items/{saved["id"]}', json={
        "origin": {"status": "answered"}, "content": "This is verified",
    }).status_code == 422
    assert client.patch(f'/api/notebook/items/{saved["id"]}', json={
        "page_id": other_page["id"],
    }).status_code == 422
    assert client.post("/api/study-sessions", json={
        "path_id": other_path.id, "title": "Cross journey selection", "item_ids": [saved["id"]],
    }).status_code == 422
    assert client.post("/api/exports", json={
        "path_id": other_path.id, "title": "Cross journey export", "item_ids": [saved["id"]],
    }).status_code == 422
