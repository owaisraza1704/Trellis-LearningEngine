from sqlalchemy import event
from sqlmodel import select

from trellis.models import LearningPath, LearningSession, Node


def create_path(client, title):
    response = client.post("/api/paths", json={"input": title})
    assert response.status_code == 201, response.text
    return response.json()


def paths_by_id(client):
    response = client.get("/api/paths")
    assert response.status_code == 200
    return {path["id"]: path for path in response.json()}


def test_new_journey_does_not_replace_global_resume_or_claim_study(client, stub_ai):
    first = create_path(client, "Learning Python")
    assert client.get("/api/workspace").json()["location"] == {
        "path_id": None, "node_id": None, "thread_id": None,
    }
    untouched = paths_by_id(client)[first["id"]]
    assert untouched["resume"] is None
    assert untouched["last_studied_at"] is None
    assert untouched["notebook_item_count"] == 0
    assert untouched["notebook_updated_at"] is None

    location = {"path_id": first["id"], "node_id": first["nodes"][1]["id"], "thread_id": None}
    assert client.put("/api/location", json=location).status_code == 200
    studied_at = paths_by_id(client)[first["id"]]["last_studied_at"]
    second = create_path(client, "Learning system design")
    workspace = client.get("/api/workspace").json()
    assert workspace["location"] == location
    paths = {path["id"]: path for path in workspace["paths"]}
    assert paths[first["id"]]["last_studied_at"] == studied_at
    assert paths[second["id"]]["resume"] is None
    assert paths[second["id"]]["last_studied_at"] is None


def test_each_journey_keeps_its_node_or_thread_while_browsing_another(client, stub_ai):
    first = create_path(client, "Learning Python")
    second = create_path(client, "Learning system design")
    first_node = first["nodes"][1]["id"]
    thread = client.post(f"/api/nodes/{first_node}/threads", json={"title": "A tangent"}).json()
    first_location = {"path_id": first["id"], "node_id": first_node, "thread_id": thread["id"]}
    second_location = {"path_id": second["id"], "node_id": second["nodes"][2]["id"], "thread_id": None}
    assert client.put("/api/location", json=first_location).status_code == 200
    assert client.put("/api/location", json=second_location).status_code == 200
    before = paths_by_id(client)

    for endpoint in (
        f"/api/paths/{first['id']}", f"/api/notebook/pages?path_id={first['id']}",
        f"/api/sources?path_id={first['id']}", f"/api/study-sessions?path_id={first['id']}",
        "/api/paths", "/api/workspace",
    ):
        assert client.get(endpoint).status_code == 200
    assert client.get("/api/workspace").json()["location"] == second_location
    after = paths_by_id(client)
    for path in (first, second):
        assert after[path["id"]]["last_studied_at"] == before[path["id"]]["last_studied_at"]
    assert after[first["id"]]["resume"] == first_location
    assert after[second["id"]]["resume"] == second_location

    assert client.put("/api/location", json=after[first["id"]]["resume"]).json() == first_location
    restored = paths_by_id(client)
    assert restored[first["id"]]["last_studied_at"] > before[first["id"]]["last_studied_at"]
    assert restored[second["id"]]["resume"] == second_location
    assert restored[second["id"]]["last_studied_at"] == before[second["id"]]["last_studied_at"]


def test_empty_locations_do_not_erase_per_journey_study_position(client, session, stub_ai):
    path = create_path(client, "Learning Python")
    location = {"path_id": path["id"], "node_id": path["nodes"][1]["id"], "thread_id": None}
    client.put("/api/location", json=location)
    before = paths_by_id(client)[path["id"]]
    assert client.put("/api/location", json={"path_id": path["id"], "node_id": None}).status_code == 200
    session.add(LearningSession(path_id=path["id"]))
    session.commit()
    after = paths_by_id(client)[path["id"]]
    assert after["resume"] == location
    assert after["last_studied_at"] == before["last_studied_at"]


def test_notebook_and_other_journey_activity_do_not_refresh_study_recency(client, stub_ai):
    first = create_path(client, "Learning Python")
    second = create_path(client, "Learning system design")
    location = {"path_id": first["id"], "node_id": first["nodes"][0]["id"], "thread_id": None}
    client.put("/api/location", json=location)
    before = paths_by_id(client)
    for path in (first, second):
        page = client.post("/api/notebook/pages", json={"path_id": path["id"], "title": "Review"}).json()
        assert client.post("/api/notebook/items", json={
            "page_id": page["id"], "node_id": path["nodes"][0]["id"], "content": "My saved idea",
        }).status_code == 201
        assert client.patch(f"/api/nodes/{path['nodes'][0]['id']}", json={"title": "Edited topic"}).status_code == 200
    assert client.patch(f"/api/nodes/{second['nodes'][0]['id']}/progress", json={"status": "completed"}).status_code == 200
    after = paths_by_id(client)
    assert client.get("/api/workspace").json()["location"] == location
    for path in (first, second):
        assert after[path["id"]]["last_studied_at"] == before[path["id"]]["last_studied_at"]
        assert after[path["id"]]["resume"] == before[path["id"]]["resume"]


def test_notebook_metadata_tracks_sections_note_edits_moves_reorders_and_deletes(client, stub_ai):
    path = create_path(client, "Learning system design")
    page = client.post("/api/notebook/pages", json={"path_id": path["id"], "title": "Ideas"}).json()
    metadata = paths_by_id(client)[path["id"]]
    assert metadata["notebook_item_count"] == 0
    assert metadata["notebook_updated_at"] is not None
    assert metadata["last_studied_at"] is None
    note = client.post("/api/notebook/items", json={"page_id": page["id"], "content": "Cache misses"}).json()
    after = paths_by_id(client)[path["id"]]
    assert after["notebook_item_count"] == 1
    assert after["notebook_updated_at"] > metadata["notebook_updated_at"]
    destination = client.post("/api/notebook/pages", json={"path_id": path["id"], "title": "Patterns"}).json()
    operations = (
        ("patch", f"/api/notebook/items/{note['id']}", {"content": "Updated cache notes"}, 1),
        ("patch", f"/api/notebook/items/{note['id']}", {"page_id": destination["id"]}, 1),
        ("post", f"/api/notebook/pages/{destination['id']}/reorder", {"item_ids": [note["id"]]}, 1),
        ("patch", f"/api/notebook/pages/{destination['id']}", {"title": "Reading patterns"}, 1),
        ("delete", f"/api/notebook/items/{note['id']}", None, 0),
        ("delete", f"/api/notebook/pages/{destination['id']}", None, 0),
    )
    for method, endpoint, body, count in operations:
        before = paths_by_id(client)[path["id"]]
        response = client.request(method, endpoint, json=body)
        assert response.is_success, response.text
        after = paths_by_id(client)[path["id"]]
        assert after["notebook_item_count"] == count
        assert after["notebook_updated_at"] > before["notebook_updated_at"]
        assert after["last_studied_at"] is None


def test_listing_more_journeys_does_not_add_queries_per_journey(client, session, db_engine, stub_ai):
    create_path(client, "First journey")
    statements = []

    def record_statement(connection, cursor, statement, parameters, context, executemany):
        statements.append(statement)

    event.listen(db_engine, "before_cursor_execute", record_statement)
    try:
        assert len(paths_by_id(client)) == 1
        baseline = len(statements)
        for index in range(20):
            path = LearningPath(title=f"Journey {index}", input="A learning goal")
            session.add(path)
            session.flush()
            session.add(Node(path_id=path.id, title="First topic"))
        session.commit()
        statements.clear()
        assert len(paths_by_id(client)) == 21
        assert len(statements) == baseline
        assert session.exec(select(LearningSession)).all() == []
    finally:
        event.remove(db_engine, "before_cursor_execute", record_statement)
