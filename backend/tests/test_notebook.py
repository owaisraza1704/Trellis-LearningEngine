from copy import deepcopy
from pathlib import Path
import shutil

import pymupdf
import pytest
from markdown_it import MarkdownIt

from trellis import notebook
from trellis.models import ExportRecord, Interaction, LearningPath, Node, NotebookItem, NotebookPage, StudySet, Thread


@pytest.fixture
def learning_origin(session):
    path = LearningPath(title="Database foundations", input="Understand databases")
    session.add(path)
    session.flush()
    node = Node(path_id=path.id, title="Transactions")
    other = Node(path_id=path.id, title="Indexes", position=1)
    session.add_all([node, other])
    session.flush()
    thread = Thread(path_id=path.id, node_id=node.id, title="Isolation levels")
    session.add(thread)
    session.flush()
    interaction = Interaction(
        path_id=path.id, node_id=node.id, thread_id=thread.id,
        prompt="Explain atomicity", content="A transaction commits completely or not at all. [1]",
        provider="test", model="test",
        evidence=[{
            "id": "E1", "source_id": "reference", "title": "PostgreSQL documentation",
            "url": "https://www.postgresql.org/docs/current/tutorial-transactions.html",
            "location": "Transactions", "kind": "url",
            "excerpt": "A transaction is said to be atomic: it does not happen partially.",
        }],
    )
    session.add(interaction)
    session.commit()
    return {"path": path.id, "node": node.id, "other": other.id,
            "thread": thread.id, "interaction": interaction.id}


def test_saved_response_keeps_immutable_origin_while_moving_and_editing(client, session, learning_origin):
    page = client.post("/api/notebook/pages", json={"path_id": learning_origin["path"], "title": "Concepts"}).json()
    destination = client.post("/api/notebook/pages", json={"path_id": learning_origin["path"], "title": "Revision"}).json()
    response = client.post("/api/notebook/items", json={
        "page_id": page["id"], "interaction_id": learning_origin["interaction"],
    })
    assert response.status_code == 201
    saved = response.json()
    original_origin = deepcopy(saved["origin"])
    original_evidence = deepcopy(saved["evidence"])
    assert saved["origin"]["path_title"] == "Database foundations"
    assert saved["origin"]["node_title"] == "Transactions"
    assert saved["origin"]["thread_title"] == "Isolation levels"
    assert saved["kind"] == "response"
    event = client.get("/api/history").json()[0]
    assert event["notebook_item_id"] == saved["id"]
    assert event["interaction_id"] == learning_origin["interaction"]
    assert client.delete(f'/api/notebook/pages/{page["id"]}').status_code == 409

    interaction = session.get(Interaction, learning_origin["interaction"])
    interaction.content = "Changed source history for snapshot verification"
    interaction.evidence = []
    node = session.get(Node, learning_origin["node"])
    node.title = "Renamed node"
    session.add_all([interaction, node])
    session.commit()

    result = client.patch(f'/api/notebook/items/{saved["id"]}', json={
        "page_id": destination["id"], "title": "My summary", "content": "My edited retained text",
    })
    assert result.status_code == 200
    assert result.json()["origin"] == original_origin
    assert result.json()["evidence"] == original_evidence
    assert result.json()["position"] == 0
    session.refresh(interaction)
    assert interaction.content == "Changed source history for snapshot verification"
    assert client.delete(f'/api/notebook/pages/{page["id"]}').status_code == 204
    restored = client.get("/api/notebook/pages").json()
    assert restored[0]["items"][0]["content"] == "My edited retained text"


def test_origin_and_evidence_membership_are_validated(client, learning_origin):
    page = client.post("/api/notebook/pages", json={"path_id": learning_origin["path"], "title": "Evidence"}).json()
    base = {"page_id": page["id"], "interaction_id": learning_origin["interaction"]}
    assert client.post("/api/notebook/items", json={
        **base, "node_id": learning_origin["other"],
    }).status_code == 422
    assert client.post("/api/notebook/items", json={**base, "evidence_id": "unrelated"}).status_code == 422
    assert client.post("/api/notebook/items", json={
        "page_id": page["id"], "evidence_id": "E1", "content": "Unattributed excerpt",
    }).status_code == 422
    assert client.post("/api/notebook/items", json={
        "page_id": page["id"], "content": "A note", "thread_id": learning_origin["thread"],
        "node_id": learning_origin["other"],
    }).status_code == 422
    excerpt = client.post("/api/notebook/items", json={**base, "evidence_id": "E1"})
    assert excerpt.status_code == 201
    assert excerpt.json()["kind"] == "evidence"
    assert excerpt.json()["content"] == excerpt.json()["evidence"][0]["excerpt"]
    assert excerpt.json()["origin"]["interaction_id"] == learning_origin["interaction"]


def test_scoped_note_refreshes_path_without_changing_last_studied(client, learning_origin):
    client.put("/api/location", json={"path_id": learning_origin["path"],
                                     "node_id": learning_origin["node"],
                                     "thread_id": learning_origin["thread"]})
    old_path = client.get(f'/api/paths/{learning_origin["path"]}').json()["updated_at"]
    old_period = client.get("/api/learning-sessions").json()[0]["last_active_at"]
    page = client.post("/api/notebook/pages", json={"path_id": learning_origin["path"], "title": "Review"}).json()
    saved = client.post("/api/notebook/items", json={"page_id": page["id"],
        "node_id": learning_origin["node"], "thread_id": learning_origin["thread"],
        "content": "My own understanding of atomicity."})
    assert saved.status_code == 201
    assert client.get(f'/api/paths/{learning_origin["path"]}').json()["updated_at"] > old_path
    assert client.get("/api/learning-sessions").json()[0]["last_active_at"] == old_period
    event = client.get("/api/history").json()[0]
    assert event["kind"] == "notebook_saved"
    assert event["node_id"] == learning_origin["node"]
    assert event["thread_id"] == learning_origin["thread"]
    assert event["notebook_item_id"] == saved.json()["id"]
    assert event["interaction_id"] is None


def test_withheld_answer_cannot_be_saved_as_teaching_content(client, session, learning_origin):
    interaction = session.get(Interaction, learning_origin["interaction"])
    interaction.status = "abstained"
    interaction.content = "Internal assessment of unsupported claims."
    session.add(interaction)
    session.commit()
    page = client.post("/api/notebook/pages", json={"path_id": learning_origin["path"], "title": "Evidence notes"}).json()
    request = {"page_id": page["id"], "interaction_id": interaction.id}
    assert client.post("/api/notebook/items", json=request).status_code == 422
    assert client.get("/api/notebook/pages").json()[0]["items"] == []
    assert client.post("/api/notebook/items", json={**request, "evidence_id": "E1"}).status_code == 201


def test_page_item_order_and_study_selection_persist(client, session, learning_origin):
    page = client.post("/api/notebook/pages", json={"path_id": learning_origin["path"], "title": "Notes"}).json()
    other = client.post("/api/notebook/pages", json={"path_id": learning_origin["path"], "title": "Next page"}).json()
    items = [client.post("/api/notebook/items", json={
        "page_id": page["id"], "title": title, "content": f"Note {title}",
    }).json() for title in ["One", "Two", "Three"]]
    order = [items[2]["id"], items[0]["id"], items[1]["id"]]
    assert client.post(f'/api/notebook/pages/{page["id"]}/reorder', json={
        "item_ids": [items[0]["id"], items[0]["id"], items[1]["id"]],
    }).status_code == 422
    result = client.post(f'/api/notebook/pages/{page["id"]}/reorder', json={"item_ids": order})
    assert result.status_code == 200
    assert [item["id"] for item in result.json()["items"]] == order
    assert client.patch(f'/api/notebook/pages/{other["id"]}', json={"position": 0}).status_code == 200
    assert client.get("/api/notebook/pages").json()[0]["id"] == other["id"]

    assert client.post("/api/study-sessions", json={
        "path_id": learning_origin["path"], "title": "Study", "item_ids": [items[0]["id"], items[0]["id"]],
    }).status_code == 422
    study = client.post("/api/study-sessions", json={"path_id": learning_origin["path"], "title": "Study", "item_ids": order}).json()
    session.expire_all()
    assert session.get(StudySet, study["id"]).item_ids == order
    assert client.get("/api/study-sessions").json()[0]["item_ids"] == order
    assert client.delete(f'/api/notebook/items/{items[0]["id"]}').status_code == 204
    assert client.get("/api/study-sessions").json()[0]["item_ids"] == [items[2]["id"], items[1]["id"]]
    pages = client.get("/api/notebook/pages").json()
    retained = next(entry for entry in pages if entry["id"] == page["id"])["items"]
    assert [item["position"] for item in retained] == [0, 1]


def test_pdf_contains_only_ordered_selection_with_provenance_and_markdown(
    client, session, learning_origin, tmp_path, monkeypatch,
):
    monkeypatch.setattr(notebook.settings, "data_dir", tmp_path)
    page = client.post("/api/notebook/pages", json={"path_id": learning_origin["path"], "title": "PDF notes"}).json()
    saved = client.post("/api/notebook/items", json={
        "page_id": page["id"], "title": "SECOND SELECTED", "interaction_id": learning_origin["interaction"],
    }).json()
    note = client.post("/api/notebook/items", json={
        "page_id": page["id"], "title": "FIRST SELECTED", "content": """## Revision notes

**Atomicity** keeps a transaction together. Accented terms: café, naïve.

- Start a transaction
- Apply both changes
  - Nested checklist
- Commit

| Operation | Meaning |
| --- | --- |
| BEGIN | Start work |
| COMMIT | Retain all changes |

```sql
BEGIN;
UPDATE accounts SET balance = balance - 10 WHERE id = 1;
COMMIT;
```

> A personal reminder with [documentation](https://www.postgresql.org/docs/).
""",
    }).json()
    unselected = client.post("/api/notebook/items", json={
        "page_id": page["id"], "title": "PRIVATE UNSELECTED", "content": "MUST NEVER APPEAR IN THIS PDF",
    }).json()
    order = [note["id"], saved["id"]]
    study = client.post("/api/study-sessions", json={"path_id": learning_origin["path"], "title": "Review", "item_ids": order}).json()
    response = client.post("/api/exports", json={
        "path_id": learning_origin["path"], "title": "Transaction revision", "item_ids": order, "study_session_id": study["id"],
    })
    assert response.status_code == 201
    result = response.json()
    assert result["status"] == "completed", result
    assert result["item_ids"] == order
    download = client.get(result["download_url"])
    assert download.status_code == 200
    assert download.headers["content-type"] == "application/pdf"
    with pymupdf.open(stream=download.content, filetype="pdf") as document:
        text = "\n".join(page.get_text() for page in document)
        assert text.index("FIRST SELECTED") < text.index("SECOND SELECTED")
        for phrase in ["Database foundations", "Transactions", "Isolation levels",
                       "[1] PostgreSQL documentation", "postgresql.org", "BEGIN", "COMMIT", "café"]:
            assert phrase in text
        assert "PRIVATE UNSELECTED" not in text
        assert "MUST NEVER APPEAR" not in text
        links = {link.get("uri") for page in document for link in page.get_links()}
        assert "https://www.postgresql.org/docs/current/tutorial-transactions.html" in links
        assert "https://www.postgresql.org/docs/" in links
        for pdf_page in document:
            pixmap = pdf_page.get_pixmap()
            assert pixmap.width > 500 and pixmap.height > 700
    record = session.get(ExportRecord, result["id"])
    frozen = deepcopy(record.snapshot)
    client.patch(f'/api/notebook/items/{note["id"]}', json={"content": "Edited after export"})
    session.refresh(record)
    assert record.snapshot == frozen
    assert client.post("/api/exports", json={
        "path_id": learning_origin["path"], "title": "Invalid selection", "item_ids": [unselected["id"]], "study_session_id": study["id"],
    }).status_code == 422


def test_failed_export_preserves_material_and_selection(client, session, monkeypatch, tmp_path, learning_origin):
    monkeypatch.setattr(notebook.settings, "data_dir", tmp_path)
    page = client.post("/api/notebook/pages", json={"path_id": learning_origin["path"], "title": "Safe notes"}).json()
    note = client.post("/api/notebook/items", json={
        "page_id": page["id"], "title": "Keep me", "content": "My original note",
    }).json()
    study = client.post("/api/study-sessions", json={
        "path_id": learning_origin["path"], "title": "Keep selection", "item_ids": [note["id"]],
    }).json()

    def fail_render(record, output):
        output.write_bytes(b"incomplete PDF")
        raise RuntimeError("Simulated PDF renderer failure")

    monkeypatch.setattr(notebook, "render_pdf", fail_render)
    response = client.post("/api/exports", json={
        "path_id": learning_origin["path"], "title": "Failed export", "item_ids": [note["id"]], "study_session_id": study["id"],
    })
    assert response.status_code == 201
    result = response.json()
    assert result["status"] == "failed"
    assert result["error"] and result["download_url"] is None
    assert client.get(f'/api/exports/{result["id"]}/download').status_code == 409
    assert client.get("/api/notebook/pages").json()[0]["items"][0]["content"] == "My original note"
    assert client.get("/api/study-sessions").json()[0]["item_ids"] == [note["id"]]
    assert not list((tmp_path / "exports").glob("*.pdf"))
    record = session.get(ExportRecord, result["id"])
    assert record.snapshot[0]["content"] == "My original note"
    assert client.get(f'/api/exports/{record.id}').json()["status"] == "failed"
    assert client.post("/api/exports", json={"path_id": learning_origin["path"], "title": "Empty", "item_ids": []}).status_code == 422


def test_pdf_repairs_legacy_response_fences_without_changing_snapshot(tmp_path):
    original = "```python\nitems.append(4)\n``` [1]\n\nThe item is now last."
    record = ExportRecord(title="Saved code", snapshot=[{
        "title": "Append example", "kind": "response", "content": original,
    }])
    output = tmp_path / "legacy-response.pdf"
    notebook.render_pdf(record, output)
    with pymupdf.open(output) as document:
        text = "\n".join(page.get_text() for page in document)
    assert "items.append(4)" in text
    assert "[1]" in text
    assert "The item is now last." in text
    assert "```" not in text
    assert record.snapshot[0]["content"] == original


def test_legacy_fence_repair_preserves_literal_shorter_fences():
    original = "````markdown\n``` [1]\n````\n\n~~~python\nitems.append(4)\n~~~ [2] [3]"
    tokens = MarkdownIt().parse(notebook.repair_cited_fences(original))
    code = [token.content for token in tokens if token.type == "fence"]
    assert code == ["``` [1]\n", "items.append(4)\n"]
    assert any(token.content == "[2] [3]" for token in tokens if token.type == "inline")


def test_pdf_download_survives_data_directory_relocation_and_legacy_paths(
    client, session, monkeypatch, tmp_path, learning_origin,
):
    original_directory = tmp_path / "host-data"
    monkeypatch.setattr(notebook.settings, "data_dir", original_directory)
    page = client.post("/api/notebook/pages", json={"path_id": learning_origin["path"], "title": "Portable notes"}).json()
    note = client.post("/api/notebook/items", json={
        "page_id": page["id"], "title": "Keep across moves", "content": "My portable study note",
    }).json()
    exported = client.post("/api/exports", json={
        "path_id": learning_origin["path"], "title": "Portable PDF", "item_ids": [note["id"]],
    }).json()
    assert exported["status"] == "completed"
    record = session.get(ExportRecord, exported["id"])
    assert record.file_path == f"exports/{record.id}.pdf"
    original_file = original_directory / record.file_path
    original_bytes = original_file.read_bytes()

    relocated_directory = tmp_path / "container-data"
    shutil.copytree(original_directory / "exports", relocated_directory / "exports")
    original_file.unlink()
    monkeypatch.setattr(notebook.settings, "data_dir", relocated_directory)
    relocated = client.get(exported["download_url"])
    assert relocated.status_code == 200
    assert relocated.content == original_bytes

    # Existing host-mode records identify the PDF, but their old absolute path is never opened.
    record.file_path = str(original_file)
    session.add(record)
    session.commit()
    legacy = client.get(exported["download_url"])
    assert legacy.status_code == 200
    assert legacy.content == original_bytes
    assert not Path(record.file_path).exists()

    record.file_path = "/etc/passwd"
    session.add(record)
    session.commit()
    assert client.get(exported["download_url"]).status_code == 404


def test_journey_notebooks_reject_cross_journey_origins_moves_and_selections(
    client, session, learning_origin,
):
    path_a = learning_origin["path"]
    other_path = LearningPath(title="Python", input="Learn Python")
    session.add(other_path)
    session.flush()
    other_node = Node(path_id=other_path.id, title="Lists")
    session.add(other_node)
    session.commit()
    path_b = other_path.id
    page_a = client.post("/api/notebook/pages", json={"path_id": path_a, "title": "Concepts"}).json()
    page_a2 = client.post("/api/notebook/pages", json={"path_id": path_a, "title": "Revision"}).json()
    page_b = client.post("/api/notebook/pages", json={"path_id": path_b, "title": "Concepts"}).json()
    note_a = client.post("/api/notebook/items", json={"page_id": page_a["id"], "content": "Personal database note"}).json()
    note_b = client.post("/api/notebook/items", json={"page_id": page_b["id"], "content": "Personal Python note"}).json()
    assert note_a["path_id"] == path_a
    assert note_a["origin"]["path_id"] == path_a
    assert note_a["node_id"] is None and "node_id" not in note_a["origin"]
    assert {page["id"] for page in client.get(f"/api/notebook/pages?path_id={path_a}").json()} == {page_a["id"], page_a2["id"]}
    assert len(client.get("/api/notebook/pages").json()) == 3

    for origin in [
        {"interaction_id": learning_origin["interaction"]},
        {"interaction_id": learning_origin["interaction"], "evidence_id": "E1"},
        {"node_id": learning_origin["node"], "content": "Wrong journey"},
        {"thread_id": learning_origin["thread"], "content": "Wrong thread journey"},
    ]:
        assert client.post("/api/notebook/items", json={"page_id": page_b["id"], **origin}).status_code == 422
    assert client.patch(f'/api/notebook/items/{note_a["id"]}', json={"page_id": page_b["id"]}).status_code == 422
    assert client.patch(f'/api/notebook/items/{note_a["id"]}', json={"page_id": page_a2["id"]}).status_code == 200
    assert client.patch(f'/api/notebook/pages/{page_a2["id"]}', json={"position": 0}).status_code == 200
    assert client.get(f"/api/notebook/pages?path_id={path_b}").json()[0]["position"] == 0

    assert client.post("/api/study-sessions", json={
        "path_id": path_a, "title": "Mixed", "item_ids": [note_a["id"], note_b["id"]],
    }).status_code == 422
    study_a = client.post("/api/study-sessions", json={
        "path_id": path_a, "title": "Databases", "item_ids": [note_a["id"]],
    }).json()
    study_b = client.post("/api/study-sessions", json={
        "path_id": path_b, "title": "Python", "item_ids": [note_b["id"]],
    }).json()
    assert client.patch(f'/api/study-sessions/{study_a["id"]}', json={"item_ids": [note_b["id"]]}).status_code == 422
    assert [study["id"] for study in client.get(f"/api/study-sessions?path_id={path_a}").json()] == [study_a["id"]]
    assert client.post("/api/exports", json={
        "path_id": path_a, "title": "Wrong notes", "item_ids": [note_b["id"]],
    }).status_code == 422
    assert client.post("/api/exports", json={
        "path_id": path_a, "title": "Wrong study", "item_ids": [note_a["id"]], "study_session_id": study_b["id"],
    }).status_code == 422
    exported = client.post("/api/exports", json={
        "path_id": path_a, "title": "Database review", "item_ids": [note_a["id"]], "study_session_id": study_a["id"],
    }).json()
    assert exported["path_id"] == path_a and exported["status"] == "completed"
    assert [record["id"] for record in client.get(f"/api/exports?path_id={path_a}").json()] == [exported["id"]]
    assert client.get(f"/api/exports?path_id={path_b}").json() == []


def test_unassigned_legacy_notebook_material_is_read_only(client, session, learning_origin):
    page = NotebookPage(title="Unassigned legacy section")
    session.add(page)
    session.flush()
    item = NotebookItem(page_id=page.id, title="Legacy note", content="Preserve this note")
    study = StudySet(title="Legacy study", item_ids=[item.id])
    session.add_all([item, study])
    session.commit()
    assert client.get("/api/notebook/pages").json()[0]["path_id"] is None
    assert client.get(f'/api/notebook/pages?path_id={learning_origin["path"]}').json() == []
    assert client.post("/api/notebook/pages", json={"title": "Missing journey"}).status_code == 422
    assert client.patch(f"/api/notebook/pages/{page.id}", json={"title": "Changed"}).status_code == 409
    assert client.post("/api/notebook/items", json={"page_id": page.id, "content": "New note"}).status_code == 409
    assert client.patch(f"/api/notebook/items/{item.id}", json={"content": "Changed"}).status_code == 409
    assert client.delete(f"/api/notebook/items/{item.id}").status_code == 409
    assert client.delete(f"/api/notebook/pages/{page.id}").status_code == 409
    assert client.post(f"/api/notebook/pages/{page.id}/reorder", json={"item_ids": [item.id]}).status_code == 409
    assert client.patch(f"/api/study-sessions/{study.id}", json={"title": "Changed"}).status_code == 409
    session.refresh(item)
    assert item.content == "Preserve this note"
