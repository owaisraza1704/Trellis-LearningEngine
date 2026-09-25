from datetime import datetime, timezone
from importlib import import_module
from uuid import uuid4

from alembic.migration import MigrationContext
from alembic.operations import Operations
import pytest
import sqlalchemy as sa

from trellis.db import engine


@pytest.fixture
def legacy_connection():
    schema = "test_notebook_migration_" + uuid4().hex
    with engine.begin() as connection:
        connection.execute(sa.text(f'CREATE SCHEMA "{schema}"'))
    try:
        with engine.begin() as connection:
            connection.execute(sa.text(f'SET LOCAL search_path TO "{schema}", public'))
            context = MigrationContext.configure(connection)
            with Operations.context(context):
                for revision in (
                    "48496885fc84_initial_learning_workspace",
                    "3dc1cfb56e62_learning_session_periods",
                    "6f04ab91c572_curriculum_provenance",
                ):
                    import_module(f"migrations.versions.{revision}").upgrade()
            yield connection
    finally:
        with engine.begin() as connection:
            connection.execute(sa.text(f'DROP SCHEMA "{schema}" CASCADE'))


def test_migration_preserves_notes_origins_selections_and_pdf_snapshots(legacy_connection):
    connection = legacy_connection
    metadata = sa.MetaData()
    tables = {
        name: sa.Table(name, metadata, autoload_with=connection)
        for name in ("learningpath", "notebookpage", "notebookitem", "studyset", "exportrecord")
    }
    now = datetime.now(timezone.utc)
    for path_id in ("journey-a", "journey-b"):
        connection.execute(tables["learningpath"].insert().values(
            id=path_id, created_at=now, updated_at=now, title=path_id,
            description="", input=path_id, generation={},
        ))
    page_ids = ("mixed", "unique", "empty", "origin", "unknown", "known-mixed")
    connection.execute(tables["notebookpage"].insert(), [
        {"id": page_id, "created_at": now, "title": page_id, "position": index}
        for index, page_id in enumerate(page_ids)
    ])
    definitions = [
        ("mixed-a", "mixed", "journey-a", {"path_id": "journey-a", "node_title": "Preserved origin"}),
        ("mixed-b", "mixed", "journey-b", {"path_id": "journey-b"}),
        ("mixed-unscoped", "mixed", None, {}),
        ("unique-a", "unique", "journey-a", {"path_id": "journey-a"}),
        ("unique-unscoped", "unique", None, {}),
        ("origin-b", "origin", None, {"path_id": "journey-b", "path_title": "Historic title"}),
        ("unknown-note", "unknown", None, {}),
        ("known-a-first", "known-mixed", "journey-a", {"path_id": "journey-a"}),
        ("known-b", "known-mixed", "journey-b", {"path_id": "journey-b"}),
        ("known-a-last", "known-mixed", "journey-a", {"path_id": "journey-a"}),
    ]
    original_items = {
        item_id: {
            "id": item_id, "page_id": page_id, "created_at": now, "title": item_id,
            "content": f"Original content for {item_id}", "position": index, "kind": "note",
            "path_id": path_id, "node_id": None, "thread_id": None, "interaction_id": None,
            "origin": origin, "evidence": [],
        }
        for index, (item_id, page_id, path_id, origin) in enumerate(definitions)
    }
    connection.execute(tables["notebookitem"].insert(), list(original_items.values()))
    original_studies = {
        "study-a": ["unique-a", "unique-unscoped"],
        "study-mixed": ["mixed-a", "mixed-b"],
        "study-unassigned": ["unknown-note"],
        "study-empty": [],
    }
    connection.execute(tables["studyset"].insert(), [
        {"id": study_id, "created_at": now, "title": study_id, "item_ids": selected}
        for study_id, selected in original_studies.items()
    ])
    snapshots = {
        "export-a": [
            {key: value for key, value in original_items[item_id].items() if key != "created_at"}
            for item_id in ("unique-a", "unique-unscoped")
        ],
        "export-mixed": [
            {key: value for key, value in original_items[item_id].items() if key != "created_at"}
            for item_id in ("mixed-a", "mixed-b")
        ],
        "export-empty": [{
            "id": "deleted-note", "page_id": "empty", "path_id": "journey-a",
            "content": "Historic exported content", "origin": {"path_title": "Original journey title"},
        }],
        "export-unassigned": [{"id": "unknown-note", "page_id": "unknown", "origin": {}}],
    }
    original_exports = {
        export_id: {
            "id": export_id, "created_at": now, "title": export_id,
            "status": "completed", "error": None, "file_path": f"/old/data/exports/{export_id}.pdf",
            "study_session_id": export_id.replace("export-", "study-"), "snapshot": snapshot,
        }
        for export_id, snapshot in snapshots.items()
    }
    connection.execute(tables["exportrecord"].insert(), list(original_exports.values()))

    context = MigrationContext.configure(connection)
    with Operations.context(context):
        import_module("migrations.versions.9b72d630fa14_journey_notebooks").upgrade()
    migrated_metadata = sa.MetaData()
    rows = {}
    for name in ("notebookpage", "notebookitem", "studyset", "exportrecord"):
        table = sa.Table(name, migrated_metadata, autoload_with=connection)
        rows[name] = {row["id"]: dict(row) for row in connection.execute(sa.select(table)).mappings()}
    pages, items = rows["notebookpage"], rows["notebookitem"]
    assert set(page_ids) <= pages.keys()
    assert len(pages) == 9
    assert items.keys() == original_items.keys()
    for item_id, original in original_items.items():
        for field, value in original.items():
            if field not in {"page_id", "path_id", "position"}:
                assert items[item_id][field] == value
        assert pages[items[item_id]["page_id"]]["path_id"] == items[item_id]["path_id"]
    assert pages["mixed"]["path_id"] is None
    assert items["mixed-unscoped"]["page_id"] == "mixed"
    assert items["mixed-a"]["page_id"] != items["mixed-b"]["page_id"]
    assert pages["unique"]["path_id"] == "journey-a"
    assert items["unique-unscoped"]["path_id"] == "journey-a"
    assert items["unique-unscoped"]["node_id"] is None
    assert items["unique-unscoped"]["origin"] == {}
    assert pages["empty"]["path_id"] == "journey-a"
    assert pages["origin"]["path_id"] == items["origin-b"]["path_id"] == "journey-b"
    assert pages["unknown"]["path_id"] is None
    assert items["unknown-note"]["path_id"] is None
    assert items["known-a-first"]["page_id"] == items["known-a-last"]["page_id"] == "known-mixed"
    assert items["known-a-first"]["position"] == 0
    assert items["known-a-last"]["position"] == 1
    assert items["known-b"]["page_id"] != "known-mixed"
    for path_id in ("journey-a", "journey-b", None):
        positions = sorted(page["position"] for page in pages.values() if page["path_id"] == path_id)
        assert positions == list(range(len(positions)))

    for study_id, selection in original_studies.items():
        assert rows["studyset"][study_id]["item_ids"] == selection
    assert rows["studyset"]["study-a"]["path_id"] == "journey-a"
    assert rows["studyset"]["study-empty"]["path_id"] == "journey-a"
    assert rows["studyset"]["study-mixed"]["path_id"] is None
    assert rows["studyset"]["study-unassigned"]["path_id"] is None
    for export_id, original in original_exports.items():
        for field, value in original.items():
            assert rows["exportrecord"][export_id][field] == value
    assert rows["exportrecord"]["export-a"]["path_id"] == "journey-a"
    assert rows["exportrecord"]["export-empty"]["path_id"] == "journey-a"
    assert rows["exportrecord"]["export-mixed"]["path_id"] is None
    assert rows["exportrecord"]["export-unassigned"]["path_id"] is None
