from pathlib import Path

from sqlmodel import select

from trellis.models import (
    Activity, Chunk, ExportRecord, Interaction, LearningPath, LearningSession, Node,
    NotebookItem, NotebookPage, Source, StudySet, Thread,
)


def test_deleting_journey_removes_its_work_and_keeps_other_journeys_and_added_sources(
    client, session, stub_ai, tmp_path,
):
    deleted = client.post("/api/paths", json={"input": "Learn Python"}).json()
    kept = client.post("/api/paths", json={"input": "Learn SQL"}).json()
    path_id = deleted["id"]
    node_id = deleted["nodes"][0]["id"]
    other_id = kept["id"]
    other_node_id = kept["nodes"][0]["id"]

    interaction = client.post(
        f"/api/nodes/{node_id}/interactions", json={"prompt": "Explain this topic"},
    ).json()
    thread = client.post(
        f"/api/nodes/{node_id}/threads", json={"title": "Side question"},
    ).json()
    assert client.put("/api/location", json={
        "path_id": path_id, "node_id": node_id, "thread_id": thread["id"],
    }).status_code == 200

    page = NotebookPage(path_id=path_id, title="Notes")
    item = NotebookItem(
        path_id=path_id, page_id=page.id, node_id=node_id,
        interaction_id=interaction["id"], title="Saved answer", content="A note",
    )
    study = StudySet(path_id=path_id, title="Review", item_ids=[item.id])
    export = ExportRecord(
        path_id=path_id, title="My notes", status="completed",
        study_session_id=study.id,
    )
    export.file_path = f"exports/{export.id}.pdf"
    added_source = Source(path_id=path_id, title="My PDF", kind="upload", status="ready")
    found_source = Source(path_id=path_id, title="Found page", kind="web", status="ready")
    found_chunk = Chunk(
        source_id=found_source.id, content="A passage", profile="test", embedding=[0.1, 0.2],
    )
    other_source = Source(path_id=other_id, title="Other material", kind="text", status="ready")
    added_source_id = added_source.id
    found_source_id = found_source.id
    found_chunk_id = found_chunk.id
    other_source_id = other_source.id
    session.add_all([page, study, added_source, found_source, other_source])
    session.flush()
    session.add_all([item, found_chunk, export])
    session.commit()
    export_file = Path(tmp_path) / "exports" / f"{export.id}.pdf"
    export_file.parent.mkdir(parents=True)
    export_file.write_bytes(b"a saved PDF")

    response = client.delete(f"/api/paths/{path_id}")
    assert response.status_code == 204, response.text
    assert client.delete(f"/api/paths/{path_id}").status_code == 404
    assert client.get("/api/workspace").json()["location"] == {
        "path_id": None, "node_id": None, "thread_id": None,
    }
    assert [path["id"] for path in client.get("/api/paths").json()] == [other_id]
    assert client.get(f"/api/paths/{other_id}").status_code == 200
    assert client.get(f"/api/nodes/{other_node_id}").status_code == 200
    assert not export_file.exists()

    assert session.get(LearningPath, path_id) is None
    for model in (
        Node, Thread, Interaction, LearningSession, Activity,
        NotebookPage, NotebookItem, StudySet, ExportRecord,
    ):
        assert not session.exec(select(model).where(model.path_id == path_id)).all()
    assert session.get(Source, added_source_id).path_id is None
    assert session.get(Source, other_source_id).path_id == other_id
    assert session.get(Source, found_source_id) is None
    assert session.get(Chunk, found_chunk_id) is None
    assert client.get(f"/api/sources/{added_source_id}").status_code == 200
    assert client.get(f"/api/sources/{found_source_id}").status_code == 404


def test_deleting_another_journey_does_not_clear_the_current_location(client, stub_ai):
    current = client.post("/api/paths", json={"input": "Learn Python"}).json()
    removed = client.post("/api/paths", json={"input": "Learn SQL"}).json()
    location = {"path_id": current["id"], "node_id": current["nodes"][0]["id"],
                "thread_id": None}
    assert client.put("/api/location", json=location).status_code == 200

    assert client.delete(f"/api/paths/{removed['id']}").status_code == 204
    assert client.get("/api/workspace").json()["location"] == location
