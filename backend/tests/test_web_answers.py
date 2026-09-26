import json

from sqlmodel import select

from trellis import ai, evidence
from trellis.models import AppSettings, Chunk, Interaction, LearningPath, Node, Source


def test_journey_answers_discover_sources_then_reuse_them_without_mixing_context(
    client, session, monkeypatch,
):
    supplied_text = "Cache-aside loads data into the cache only when the application requests it."
    web_text = "Write-through updates the backing data store when data is written to the cache."
    # A public IP keeps URL validation real without depending on external DNS.
    web_url = "https://93.184.216.34/write-through"
    gap_query = "write-through caching write behavior official documentation"
    searches = []
    downloads = []
    drafts = []

    class Search:
        def __init__(self, **kwargs):
            pass

        def text(self, query, **kwargs):
            searches.append(query)
            return [{"href": web_url, "title": "Write-through reference",
                     "body": "A discovery snippet must never become the answer."}]

    def fetch(url):
        downloads.append(url)
        assert url == web_url
        return web_text.encode(), "text/plain", url

    def embed(texts):
        _, _, dimensions, profile = ai.embedding_profile()
        return [[1.0] + [0.0] * (dimensions - 1) for _ in texts], profile

    def complete(provider, model, schema, messages):
        request = json.loads(messages[1]["content"])
        assert "Other journey private" not in json.dumps(request)
        if schema is ai.ResolvedQuestion:
            return ai.ResolvedQuestion(
                question=request["question"], search_query=request["question"], sources_only=False,
            )
        passages = request["evidence"]
        assert passages[0]["kind"] == "text"
        if schema is ai.AnswerEvaluation:
            excerpts = {item["id"]: item["excerpt"] for item in passages}
            for block in request["answer"]["blocks"]:
                assert block["text"] == excerpts[block["evidence_ids"][0]]
            return ai.AnswerEvaluation(
                relevance=1, completeness=1, consistency=1, grounding=1,
                supported=True, explanation="Every block restates its cited source passage.",
            )
        assert schema is ai.DraftAnswer
        drafts.append(request)
        supplied = next(item for item in passages if item["excerpt"] == supplied_text)
        blocks = [ai.AnswerBlock(text=supplied_text, evidence_ids=[supplied["id"]])]
        if "write-through" in request["question"]:
            web = next((item for item in passages if item["excerpt"] == web_text), None)
            if web is None:
                return ai.DraftAnswer(
                    status="answered", blocks=blocks,
                    reason="The source covers cache-aside, but not write-through.",
                    missing_evidence=gap_query,
                )
            blocks.append(ai.AnswerBlock(text=web_text, evidence_ids=[web["id"]]))
        return ai.DraftAnswer(status="answered", blocks=blocks, reason="")

    monkeypatch.setattr(evidence, "DDGS", Search)
    monkeypatch.setattr(evidence, "fetch_document", fetch)
    monkeypatch.setattr(evidence, "embed_texts", embed)
    monkeypatch.setattr(ai, "structured_completion", complete)
    path = LearningPath(title="Caching journey", input="Learn caching")
    other = LearningPath(title="Other journey private", input="Other journey private")
    session.add_all([path, other, AppSettings(provider="ollama", model="test-model")])
    session.commit()
    node = Node(path_id=path.id, title="Cache strategies")
    other_node = Node(path_id=other.id, title="Other journey private node")
    session.add_all([node, other_node])
    session.commit()
    path_id, node_id, other_id = path.id, node.id, other.id
    session.add(Interaction(
        path_id=other_id, node_id=other_node.id,
        prompt="Other journey private question", content="Other journey private answer",
    ))
    session.commit()
    for journey_id, title, content in [
        (path_id, "My cache-aside notes", supplied_text),
        (other_id, "Other journey private source", "Other journey private material"),
    ]:
        created = client.post("/api/sources/text", json={
            "path_id": journey_id, "title": title, "content": content,
        })
        assert created.status_code == 202, created.text
    session.expire_all()

    covered = client.post(f"/api/nodes/{node_id}/interactions", json={
        "prompt": "How does cache-aside load data?",
    })
    assert covered.status_code == 201, covered.text
    covered_answer = covered.json()
    assert covered_answer["status"] == "answered"
    assert covered_answer["evaluation"]["web_search_performed"] is False
    assert searches == downloads == []
    assert [item["kind"] for item in covered_answer["evidence"]] == ["text"]

    comparison = client.post(f"/api/nodes/{node_id}/interactions", json={
        "prompt": "Compare cache-aside and write-through.", "action": "comparison",
    })
    assert comparison.status_code == 201, comparison.text
    expanded = comparison.json()
    assert expanded["status"] == "answered"
    assert supplied_text in expanded["content"] and web_text in expanded["content"]
    assert "[1]" in expanded["content"] and "[2]" in expanded["content"]
    assert expanded["evaluation"]["web_search_performed"] is True
    assert expanded["evaluation"]["web_search_query"] == gap_query
    assert searches == [gap_query]
    assert downloads == [web_url]
    assert [item["kind"] for item in expanded["evidence"]] == ["text", "web"]
    assert len(drafts) == 3
    assert len(drafts[1]["evidence"]) == 1
    assert len(drafts[2]["evidence"]) == 2
    assert drafts[1]["context"]["history"][0]["prompt"] == covered_answer["prompt"]

    sources = client.get("/api/sources", params={"path_id": path_id}).json()
    assert len(sources) == 2
    discovered = next(source for source in sources if source["kind"] == "web")
    assert discovered["path_id"] == path_id
    assert discovered["url"] == web_url
    assert discovered["status"] == "ready"
    assert discovered["needs_reindex"] is False
    assert discovered["chunk_count"] == 1
    session.expire_all()
    persisted_chunk = session.exec(select(Chunk).where(Chunk.source_id == discovered["id"])).one()
    assert persisted_chunk.content == web_text
    assert expanded["evidence"][1]["id"] == persisted_chunk.id
    assert session.get(Interaction, expanded["id"]).evidence == expanded["evidence"]

    thread = client.post(f"/api/nodes/{node_id}/threads", json={
        "title": "Write-through exploration", "interaction_id": expanded["id"],
    }).json()
    before_thread = client.get(f"/api/nodes/{node_id}").json()
    thread_reply = client.post(f"/api/threads/{thread['id']}/interactions", json={
        "prompt": "In this exploration, compare cache-aside and write-through.",
    })
    assert thread_reply.status_code == 201, thread_reply.text
    assert thread_reply.json()["status"] == "answered"
    assert thread_reply.json()["evaluation"]["web_search_performed"] is False
    assert drafts[-1]["context"]["thread_id"] == thread["id"]
    assert drafts[-1]["context"]["history"] == []
    after_thread = client.get(f"/api/nodes/{node_id}").json()
    assert after_thread["interactions"] == before_thread["interactions"]
    assert after_thread["node"] == before_thread["node"]

    repeated = client.post(f"/api/nodes/{node_id}/interactions", json={
        "prompt": "Compare cache-aside and write-through.",
    })
    assert repeated.status_code == 201, repeated.text
    assert repeated.json()["status"] == "answered"
    assert repeated.json()["evaluation"]["web_search_performed"] is False
    assert repeated.json()["evidence"] == expanded["evidence"]
    assert "thread_id" not in drafts[-1]["context"]
    assert [item["prompt"] for item in drafts[-1]["context"]["history"]] == [
        covered_answer["prompt"], expanded["prompt"],
    ]
    assert searches == [gap_query]
    assert downloads == [web_url]
    assert len(client.get("/api/sources", params={"path_id": path_id}).json()) == 2
    assert len(client.get("/api/sources", params={"path_id": other_id}).json()) == 1
    assert session.get(Source, discovered["id"]).path_id == path_id
