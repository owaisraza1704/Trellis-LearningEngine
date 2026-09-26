import pytest
from sqlmodel import select

from trellis import ai, evidence
from trellis.curriculum import source_roadmap_paths
from trellis.models import Chunk, LearningPath, Source


ARTICLE = """This article introduces a system design roadmap.
1. Client-Server Architecture
Clients send requests to servers.
2. IP Address
Servers have addresses.
3. DNS
DNS maps names to addresses.
"""


def source_with_article(session, content=ARTICLE):
    source = Source(
        title="System Design roadmap", kind="url", url="https://example.org/roadmap",
        status="ready", content=content, chunk_count=1,
    )
    session.add(source)
    session.flush()
    session.add(Chunk(
        source_id=source.id, content=content, position=0, profile="test:1", embedding=[1],
    ))
    session.commit()
    return source


@pytest.mark.parametrize("mode", ["outline", "goal"])
def test_single_title_imports_matching_source_sections_without_model(
    client, session, monkeypatch, mode,
):
    source = source_with_article(session)
    monkeypatch.setattr(ai, "selected_provider", lambda *args: 1 / 0)
    monkeypatch.setattr(ai, "structured_completion", lambda *args: 1 / 0)

    response = client.post("/api/paths", json={
        "input": "System design", "mode": mode, "source_ids": [source.id],
    })

    assert response.status_code == 201, response.text
    path = response.json()
    assert [node["title"] for node in path["nodes"]] == [
        "System design", "Client-Server Architecture", "IP Address", "DNS",
    ]
    assert all(node["parent_id"] == path["nodes"][0]["id"] for node in path["nodes"][1:])
    assert path["generation"]["basis"] == "source_roadmap"
    assert path["generation"]["mode"] == mode
    assert path["generation"]["evaluation"]["status"] == "extracted"
    assert path["generation"]["evaluation"].get("completeness") is None
    assert path["generation"]["evidence"][0]["source_id"] == source.id
    assert session.get(Source, source.id).path_id == path["id"]


def test_specific_goal_does_not_silently_become_the_source_roadmap(session, monkeypatch):
    source = source_with_article(session)

    def normal_goal_planning(*args):
        raise RuntimeError("normal goal planning")

    monkeypatch.setattr(ai, "selected_provider", normal_goal_planning)
    with pytest.raises(RuntimeError, match="normal goal planning"):
        ai.generate_curriculum(
            session, "Design robust scalable AI systems", "goal", [source.id],
        )


def test_source_roadmap_preserves_markdown_heading_hierarchy(client, session, monkeypatch):
    source = source_with_article(session, "# System design\n## Networking\n### DNS\n## Storage\n")
    monkeypatch.setattr(ai, "selected_provider", lambda *args: 1 / 0)

    response = client.post("/api/paths", json={
        "input": "System design", "mode": "outline", "source_ids": [source.id],
    })

    assert response.status_code == 201, response.text
    nodes = response.json()["nodes"]
    assert [node["title"] for node in nodes] == ["System design", "Networking", "DNS", "Storage"]
    assert nodes[1]["parent_id"] == nodes[0]["id"]
    assert nodes[2]["parent_id"] == nodes[1]["id"]
    assert nodes[3]["parent_id"] == nodes[0]["id"]


def test_single_title_without_roadmap_does_not_create_one_node_path(client, session, monkeypatch):
    source = source_with_article(session, "This article has no visible roadmap sections.")
    monkeypatch.setattr(ai, "selected_provider", lambda *args: 1 / 0)

    response = client.post("/api/paths", json={
        "input": "System design", "mode": "outline", "source_ids": [source.id],
    })

    assert response.status_code == 422
    assert "no recognizable roadmap sections" in response.json()["detail"]
    assert session.exec(select(LearningPath)).all() == []


def test_single_title_requires_one_roadmap_source(client, session, monkeypatch):
    monkeypatch.setattr(ai, "selected_provider", lambda *args: 1 / 0)

    response = client.post("/api/paths", json={"input": "System design", "mode": "outline"})

    assert response.status_code == 422
    assert "select one roadmap source" in response.json()["detail"]
    assert session.exec(select(LearningPath)).all() == []


def test_new_html_source_keeps_its_roadmap_headings(monkeypatch):
    paragraph = "System design covers components, tradeoffs, and operational constraints. " * 8
    html = (
        "<html><head><title>System Design Roadmap</title></head><body><article>"
        f"<h1>System Design</h1><p>{paragraph}</p>"
        f"<h2>Networking</h2><p>{paragraph}</p>"
        f"<h3>DNS</h3><p>{paragraph}</p>"
        f"<h2>Storage</h2><p>{paragraph}</p>"
        "</article></body></html>"
    ).encode()
    monkeypatch.setattr(evidence, "fetch_document", lambda *args, **kwargs: (
        html, "text/html", "https://example.org/roadmap",
    ))
    source = Source(title="Roadmap", kind="url", url="https://example.org/roadmap")

    sections = evidence.document_sections(source)

    assert source_roadmap_paths(sections[0][0]) == [
        ("System Design",), ("System Design", "Networking"),
        ("System Design", "Networking", "DNS"), ("System Design", "Storage"),
    ]
