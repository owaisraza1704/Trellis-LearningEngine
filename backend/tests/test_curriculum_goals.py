import json
from types import SimpleNamespace

from fastapi import HTTPException
import pytest
from sqlmodel import select

from trellis import ai, evidence
from trellis.models import LearningPath, Node
from test_curriculum_structure import GPU_GOAL, GPU_PHASES


@pytest.fixture
def goal_pipeline(monkeypatch):
    plan = ai.GoalPlan(
        title="GPU systems engineering", description="Learn all four phases of GPU systems.",
        nodes=[ai.GoalBranch(
            title=phase, description=f"Study {phase}.",
            search_query=f"GPU {phase}: {', '.join(topics)}",
            children=[ai.GoalTopic(title=topic, description=f"Study {topic}.", children=[])
                      for topic in topics],
        ) for phase, topics in GPU_PHASES],
    )
    shared = {
        "id": "shared-gpu-guide", "source_id": "shared-source", "title": "GPU systems guide",
        "excerpt": "GPU systems combine architecture, kernels, runtimes and distributed execution.",
    }
    passages = {}
    branches = []
    for index, branch in enumerate(plan.nodes):
        sources = [{
            "id": f"phase-{index}-topic-{topic_index}", "source_id": f"source-{index}",
            "title": topic.title, "excerpt": f"This passage supports {topic.title}.",
        } for topic_index, topic in enumerate(branch.children)]
        passages[branch.search_query] = [*sources, dict(shared)]
        branches.append(ai.CurriculumNode(
            title=branch.title, description=branch.description, evidence_ids=[sources[0]["id"]],
            children=[ai.CurriculumNode(
                title=topic.title, description=topic.description, children=[],
                evidence_ids=[source["id"]],
            ) for topic, source in zip(branch.children, sources, strict=True)],
        ))
    state = SimpleNamespace(
        plan=plan,
        curriculum=ai.Curriculum(title=plan.title, description=plan.description, nodes=branches),
        evaluation=ai.CurriculumEvaluation(
            relevance=1, completeness=1, consistency=1, grounding=1, supported=True,
            explanation="Every requested phase and topic is represented with source support.",
            missing_topics=[], hierarchy_preserved=True,
        ),
        passages=passages, retrievals=[], completions=[], revisions=[], reviews=[],
    )

    def retrieve(session, query, **kwargs):
        state.retrievals.append((query, kwargs))
        return {"evidence": state.passages[query], "warnings": []}

    def complete(provider, model, schema, messages):
        state.completions.append((schema, json.loads(messages[1]["content"])))
        if schema == ai.GoalPlan:
            return state.plan
        if schema == ai.Curriculum:
            return state.revisions.pop(0) if state.revisions else state.curriculum
        if schema == ai.CurriculumEvaluation:
            return state.reviews.pop(0) if state.reviews else state.evaluation
        pytest.fail(f"Unexpected model schema: {schema.__name__}")

    monkeypatch.setattr(ai, "selected_provider", lambda session: ("azure", "fixture"))
    monkeypatch.setattr(evidence, "retrieve_evidence", retrieve)
    monkeypatch.setattr(ai, "structured_completion", complete)
    return state


def test_full_gpu_goal_researches_every_phase_and_keeps_all_twelve_topics(goal_pipeline):
    result = ai.generate_curriculum(None, GPU_GOAL, "goal", ["uploaded-source"])
    assert [node["title"] for node in result["nodes"]] == [
        title for phase, topics in GPU_PHASES for title in [phase, *topics]
    ]
    assert [node["parent_index"] for node in result["nodes"]] == [
        None, 0, 0, 0, None, 4, 4, 4, None, 8, 8, 8, None, 12, 12, 12,
    ]
    queries = [query for query, _ in goal_pipeline.retrievals]
    assert queries == [branch.search_query for branch in goal_pipeline.plan.nodes]
    assert len(queries) == 4
    assert all(len(query) <= 500 for query in queries)
    assert "Phase 4" not in GPU_GOAL[:500]
    assert "Distributed Communication Primitives" in queries[-1]
    assert "Serving Optimizations" in queries[-1]
    assert all(options["source_ids"] == ["uploaded-source"]
               for _, options in goal_pipeline.retrievals)
    ids = [passage["id"] for passage in result["generation"]["evidence"]]
    assert len(ids) == len(set(ids)) == 13
    assert "phase-3-topic-2" in ids
    assert ids.count("shared-gpu-guide") == 1
    calls = goal_pipeline.completions
    assert [schema for schema, _ in calls] == [ai.GoalPlan, ai.Curriculum, ai.CurriculumEvaluation]
    assert calls[0][1]["input"] == GPU_GOAL
    assert calls[-1][1]["input"] == GPU_GOAL
    assert len(calls[1][1]["evidence"]) == 13
    assert len(calls[-1][1]["evidence"]) == 13
    assert result["generation"]["evaluation"]["missing_topics"] == []
    assert result["generation"]["evaluation"]["hierarchy_preserved"] is True


@pytest.mark.parametrize("stage", ["plan", "curriculum"])
@pytest.mark.parametrize("change", ["drop", "reparent", "reorder"])
def test_requested_topic_structure_is_checked_before_and_after_research(goal_pipeline, stage, change):
    output = getattr(goal_pipeline, stage)
    topics = output.nodes[1].children
    if change == "drop":
        topics.pop(1)
    elif change == "reparent":
        output.nodes[2].children.append(topics.pop(1))
    else:
        topics[1], topics[2] = topics[2], topics[1]
    with pytest.raises(HTTPException) as failure:
        ai.generate_curriculum(None, GPU_GOAL, "goal", [])
    assert failure.value.status_code == 502
    schemas = [schema for schema, _ in goal_pipeline.completions]
    assert schemas == ([ai.GoalPlan] if stage == "plan" else [ai.GoalPlan, ai.Curriculum])
    assert len(goal_pipeline.retrievals) == (0 if stage == "plan" else 4)


@pytest.mark.parametrize("change", ["add", "rename"])
def test_enrichment_cannot_change_the_planned_topics(goal_pipeline, change):
    if change == "add":
        goal_pipeline.curriculum.nodes[1].children.append(ai.CurriculumNode(
            title="Unplanned profiling topic", description="A topic added after planning.",
            evidence_ids=["phase-1-topic-0"], children=[],
        ))
    else:
        goal_pipeline.curriculum.nodes[1].children[0].title = "Renamed kernel foundations"
    with pytest.raises(HTTPException) as failure:
        ai.generate_curriculum(None, "Learn GPU engineering thoroughly.", "goal", [])
    assert failure.value.status_code == 502
    assert [schema for schema, _ in goal_pipeline.completions] == [ai.GoalPlan, ai.Curriculum]


def test_unstructured_goal_can_infer_nested_subtopics_during_planning(goal_pipeline):
    goal_pipeline.plan.nodes[1].children[0].children.append(ai.GoalTopic(
        title="Thread indexing", description="Map threads onto data.", children=[],
    ))
    goal_pipeline.curriculum.nodes[1].children[0].children.append(ai.CurriculumNode(
        title="Thread indexing", description="Map threads onto data.",
        evidence_ids=["phase-1-topic-0"], children=[],
    ))
    result = ai.generate_curriculum(None, "Learn GPU engineering from hardware to serving.", "goal", [])
    assert len(result["nodes"]) == 17
    inferred = next(node for node in result["nodes"] if node["title"] == "Thread indexing")
    parent = result["nodes"][inferred["parent_index"]]
    assert parent["title"] == "CUDA Programming Foundations"


def test_missing_branch_evidence_names_the_unresearched_phase(goal_pipeline):
    missing = goal_pipeline.plan.nodes[-1]
    goal_pipeline.passages[missing.search_query] = []
    with pytest.raises(HTTPException) as failure:
        ai.generate_curriculum(None, GPU_GOAL, "goal", [])
    assert failure.value.status_code == 503
    assert missing.title in failure.value.detail
    assert len(goal_pipeline.retrievals) == 4
    assert [schema for schema, _ in goal_pipeline.completions] == [ai.GoalPlan]


@pytest.mark.parametrize("count", [40, 41])
def test_goal_size_limit_counts_all_nested_topics_and_never_truncates(goal_pipeline, count):
    branch = goal_pipeline.plan.nodes[0].model_copy(deep=True)
    branch.children = [ai.GoalTopic(
        title=f"GPU topic {index}", description="A requested GPU topic.", children=[],
    ) for index in range(count - 1)]
    goal_pipeline.plan.nodes = [branch]
    goal_pipeline.curriculum.nodes = [ai.CurriculumNode(
        title=branch.title, description=branch.description, evidence_ids=["phase-0-topic-0"],
        children=[ai.CurriculumNode(
            title=topic.title, description=topic.description, evidence_ids=["phase-0-topic-0"],
            children=[],
        ) for topic in branch.children],
    )]
    if count == 40:
        result = ai.generate_curriculum(None, "Learn GPU engineering in detail.", "goal", [])
        assert len(result["nodes"]) == 40
        assert result["nodes"][-1]["title"] == "GPU topic 38"
    else:
        with pytest.raises(HTTPException) as failure:
            ai.generate_curriculum(None, "Learn GPU engineering in detail.", "goal", [])
        assert failure.value.status_code == 502
        assert goal_pipeline.retrievals == []


@pytest.mark.parametrize("mode", ["goal", "outline"])
@pytest.mark.parametrize("review", [
    {"completeness": 0.24},
    {"completeness": 0.95, "missing_topics": ["Serving Optimizations"]},
    {"hierarchy_preserved": False},
])
def test_incomplete_or_restructured_curriculum_never_creates_a_path(
    client, session, goal_pipeline, mode, review,
):
    for key, value in review.items():
        setattr(goal_pipeline.evaluation, key, value)
    if mode == "outline":
        for branch in goal_pipeline.curriculum.nodes:
            branch.evidence_ids = []
            for topic in branch.children:
                topic.evidence_ids = []
    response = client.post("/api/paths", json={"input": GPU_GOAL, "mode": mode})
    assert response.status_code == 502, response.text
    assert session.exec(select(LearningPath)).all() == []
    assert session.exec(select(Node)).all() == []
    if mode == "outline":
        assert goal_pipeline.retrievals == []
        assert [schema for schema, _ in goal_pipeline.completions] == [
            ai.Curriculum, ai.CurriculumEvaluation,
        ]
    else:
        assert len(goal_pipeline.retrievals) == 4
        assert [schema for schema, _ in goal_pipeline.completions] == [
            ai.GoalPlan, ai.Curriculum, ai.CurriculumEvaluation,
            ai.Curriculum, ai.CurriculumEvaluation,
        ]


def test_one_targeted_research_repair_preserves_the_plan_and_persists_only_accepted_content(
    client, session, monkeypatch, goal_pipeline,
):
    query = "GPU INT4 four bit quantization compute precision throughput accuracy"
    added = {
        "id": "int4-passage", "source_id": "precision-source", "title": "INT4 precision guide",
        "excerpt": "INT4 is a four-bit integer representation used in quantized GPU computation.",
    }
    goal_pipeline.passages[query] = [added, *goal_pipeline.passages[goal_pipeline.plan.nodes[0].search_query]]
    rejected = goal_pipeline.evaluation.model_copy(update={
        "supported": False, "grounding": 0.75,
        "explanation": "The cited passage does not support INT4 precision.",
        "research_queries": [query, query],
    })
    revised = goal_pipeline.curriculum.model_copy(deep=True)
    revised.nodes[0].children[2].description = "Study INT4 precision using supported representations."
    revised.nodes[0].children[2].evidence_ids = [added["id"]]
    goal_pipeline.revisions = [goal_pipeline.curriculum, revised]
    goal_pipeline.reviews = [rejected, goal_pipeline.evaluation]
    original_completion = ai.structured_completion

    def complete(provider, model, schema, messages):
        assert session.exec(select(LearningPath)).all() == []
        assert session.exec(select(Node)).all() == []
        return original_completion(provider, model, schema, messages)

    monkeypatch.setattr(ai, "structured_completion", complete)
    response = client.post("/api/paths", json={"input": GPU_GOAL, "mode": "goal"})
    assert response.status_code == 201, response.text
    result = response.json()
    assert len(session.exec(select(LearningPath)).all()) == 1
    assert len(session.exec(select(Node)).all()) == 16
    precision = next(node for node in result["nodes"] if node["title"] == "Compute Precisions")
    assert precision["description"] == revised.nodes[0].children[2].description
    assert precision["evidence_ids"] == [added["id"]]
    retrievals = goal_pipeline.retrievals
    assert len(retrievals) == 5
    assert retrievals[-1][0] == query
    assert len(query) <= 500
    assert retrievals[-1][1]["supplement_web"] is True
    calls = goal_pipeline.completions
    assert [schema for schema, _ in calls] == [
        ai.GoalPlan, ai.Curriculum, ai.CurriculumEvaluation,
        ai.Curriculum, ai.CurriculumEvaluation,
    ]
    assert calls[3][1]["planned_curriculum"] == calls[1][1]["planned_curriculum"]
    assert calls[3][1]["previous_curriculum"] == goal_pipeline.curriculum.model_dump()
    assert calls[3][1]["evaluation_feedback"] == rejected.model_dump()
    assert calls[4][1]["input"] == GPU_GOAL.strip()
    evaluation = result["generation"]["evaluation"]
    assert evaluation["correction_attempted"] is True
    assert [check["supported"] for check in evaluation["checks"]] == [False, True]
    evidence_ids = [passage["id"] for passage in result["generation"]["evidence"]]
    assert len(evidence_ids) == len(set(evidence_ids)) == 14


def test_failed_second_review_never_starts_another_research_round(client, session, goal_pipeline):
    first_query = "GPU integer quantization precision support"
    second_query = "Do not execute a third research round"
    goal_pipeline.passages[first_query] = [{
        "id": "additional-precision", "source_id": "precision-source", "title": "Precision notes",
        "excerpt": "Additional material that is still insufficient.",
    }]
    rejected = goal_pipeline.evaluation.model_copy(update={
        "supported": False, "grounding": 0.5, "research_queries": [first_query],
        "explanation": "More support is required.",
    })
    goal_pipeline.reviews = [
        rejected, rejected.model_copy(update={"research_queries": [second_query]}),
    ]
    response = client.post("/api/paths", json={"input": GPU_GOAL, "mode": "goal"})
    assert response.status_code == 502, response.text
    assert session.exec(select(LearningPath)).all() == []
    assert session.exec(select(Node)).all() == []
    assert len(goal_pipeline.retrievals) == 5
    assert goal_pipeline.retrievals[-1][0] == first_query
    assert [schema for schema, _ in goal_pipeline.completions] == [
        ai.GoalPlan, ai.Curriculum, ai.CurriculumEvaluation,
        ai.Curriculum, ai.CurriculumEvaluation,
    ]


def test_a_wrong_citation_can_be_revised_once_using_existing_evidence(goal_pipeline):
    initial = goal_pipeline.curriculum.model_copy(deep=True)
    initial.nodes[0].children[2].evidence_ids = ["phase-0-topic-0"]
    rejected = goal_pipeline.evaluation.model_copy(update={
        "supported": False, "grounding": 0.8,
        "explanation": "Cite the compute precision passage rather than the architecture passage.",
    })
    goal_pipeline.revisions = [initial, goal_pipeline.curriculum]
    goal_pipeline.reviews = [rejected, goal_pipeline.evaluation]
    result = ai.generate_curriculum(None, GPU_GOAL, "goal", [])
    assert len(goal_pipeline.retrievals) == 4
    assert result["nodes"][3]["evidence_ids"] == ["phase-0-topic-2"]
    assert result["generation"]["evaluation"]["correction_attempted"] is True
    assert len(result["generation"]["evaluation"]["checks"]) == 2
    calls = goal_pipeline.completions
    assert calls[1][1]["evidence"] == calls[3][1]["evidence"]
    assert calls[3][1]["previous_curriculum"] == initial.model_dump()


@pytest.mark.parametrize("change", ["drop_topic", "invent_citation"])
def test_repair_still_requires_the_complete_plan_and_valid_citations(
    client, session, goal_pipeline, change,
):
    rejected = goal_pipeline.evaluation.model_copy(update={
        "supported": False, "grounding": 0.8, "explanation": "Improve source support.",
    })
    revised = goal_pipeline.curriculum.model_copy(deep=True)
    if change == "drop_topic":
        revised.nodes[-1].children.pop()
    else:
        revised.nodes[-1].children[-1].evidence_ids = ["fabricated-passage"]
    goal_pipeline.revisions = [goal_pipeline.curriculum, revised]
    goal_pipeline.reviews = [rejected]
    response = client.post("/api/paths", json={"input": GPU_GOAL, "mode": "goal"})
    assert response.status_code == 502, response.text
    assert session.exec(select(LearningPath)).all() == []
    assert session.exec(select(Node)).all() == []
    assert [schema for schema, _ in goal_pipeline.completions] == [
        ai.GoalPlan, ai.Curriculum, ai.CurriculumEvaluation, ai.Curriculum,
    ]
