import importlib.util
import json
from pathlib import Path
from types import SimpleNamespace

import pytest
from sqlalchemy import text
from sqlmodel import Session, select

if importlib.util.find_spec("deepeval") is None:
    pytest.skip(
        "Install the evaluation dependency group for runner tests.", allow_module_level=True
    )

from trellis import ai, evidence
from trellis.models import AppSettings, LearningPath
from trellis_eval import metrics, runner
from trellis_eval.dataset import load_dataset


DATASET = Path(__file__).resolve().parents[2] / "evaluation" / "datasets" / "v1"


@pytest.fixture
def benchmark(db_engine, monkeypatch, tmp_path):
    monkeypatch.setattr(runner, "engine", db_engine)
    with Session(db_engine) as session:
        session.add(AppSettings(provider="azure", model="fixture"))
        session.add(
            LearningPath(id="existing-journey", title="Preserve this", input="Existing work")
        )
        session.commit()

    def embeddings(texts):
        return [[1.0, 0.0, 0.0] for _ in texts], "benchmark-fixture"

    monkeypatch.setattr(ai, "embed_texts", embeddings)
    monkeypatch.setattr(evidence, "embed_texts", embeddings)
    monkeypatch.setattr(metrics, "evaluate_metrics", lambda *args, **kwargs: {})

    def draft(provider, model, schema, messages):
        payload = json.loads(messages[-1]["content"])
        assert "expected_answer" not in payload and "gold_source_ids" not in payload
        return ai.DraftAnswer(
            status="answered",
            blocks=[
                ai.AnswerBlock(
                    text="A fixture answer.",
                    evidence_ids=[payload["evidence"][0]["id"]],
                )
            ],
            reason="",
        )

    monkeypatch.setattr(ai, "structured_completion", draft)
    monkeypatch.setattr(ai, "answer", runner.baseline_answer)
    return SimpleNamespace(
        dataset=DATASET,
        split="dev",
        category="normal",
        limit=2,
        seed=17,
        provider=None,
        model=None,
        judge_provider=None,
        judge_model=None,
        repetitions=1,
        workers=2,
        variants=["baseline", "trellis"],
        output=tmp_path / "run",
    )


def test_runner_uses_pgvector_isolated_cases_and_preserves_workspace(benchmark, db_engine):
    directory = runner.run_benchmark(benchmark)
    metadata = json.loads((directory / "run.json").read_text())
    rows = [json.loads(line) for line in (directory / "rows.jsonl").read_text().splitlines()]
    assert metadata["complete"] and metadata["isolated_schema_removed"]
    assert len(rows) == 4 and all(row["status"] == "answered" for row in rows)
    assert all(len(row["retrieved_source_ids"]) == 8 for row in rows)
    assert all(len(row["retrieval"]) == 1 for row in rows)
    assert all(set(row["retrieved_source_ids"]) <= set(load_dataset(DATASET)[2]) for row in rows)
    assert metadata["implementation_sha256"]["trellis/ai.py"]
    assert (directory / "snapshot" / "dataset" / "cases.jsonl").is_file()
    assert (directory / "snapshot" / "backend" / "trellis" / "ai.py").is_file()
    assert (directory / "human_review.csv").is_file()
    with Session(db_engine) as session:
        assert [path.id for path in session.exec(select(LearningPath)).all()] == [
            "existing-journey"
        ]


def test_judge_failure_keeps_product_status_latency_and_recall(benchmark, monkeypatch):
    def broken_judge(*args, **kwargs):
        raise RuntimeError("Unexpected external judge error")

    monkeypatch.setattr(metrics, "evaluate_metrics", broken_judge)
    directory = runner.run_benchmark(benchmark)
    rows = [json.loads(line) for line in (directory / "rows.jsonl").read_text().splitlines()]
    for row in rows:
        assert row["status"] == "answered" and row["error"] is None
        assert row["latency_seconds"] >= 0
        assert row["metrics"]["answer_correctness"]["score"] is None
        assert row["metrics"]["answer_correctness"]["error"]
        assert row["metrics"]["retrieval_recall_at_8"] is not None


def test_setup_failure_does_not_create_fast_latency_or_zero_recall(benchmark, monkeypatch):
    def broken_context(*args):
        raise ValueError("Bad fixture")

    monkeypatch.setattr(runner.core, "build_context", broken_context)
    directory = runner.run_benchmark(benchmark)
    rows = [json.loads(line) for line in (directory / "rows.jsonl").read_text().splitlines()]
    assert all(row["status"] == "error" and row["latency_seconds"] is None for row in rows)
    assert all(row["metrics"]["retrieval_recall_at_8"] is None for row in rows)


def test_failed_corpus_embedding_preserves_partial_usage(benchmark, monkeypatch, db_engine):
    def failed_embedding(texts):
        runner.ai._usage_events.get().extend(
            [
                {"kind": "embedding", "input_tokens": 12, "output_tokens": 0, "total_tokens": 12},
                {
                    "kind": "embedding",
                    "input_tokens": None,
                    "output_tokens": 0,
                    "total_tokens": None,
                },
            ]
        )
        raise RuntimeError("Embedding provider unavailable")

    monkeypatch.setattr(ai, "embed_texts", failed_embedding)
    with pytest.raises(RuntimeError):
        runner.run_benchmark(benchmark)
    metadata = json.loads((benchmark.output / "run.json").read_text())
    assert not metadata["complete"]
    assert metadata["setup_usage"]["embedding_calls"] == 2
    assert metadata["setup_usage"]["total_tokens"] is None
    assert len(metadata["setup_calls"]) == 2
    with db_engine.connect() as connection:
        assert connection.execute(text("SELECT 1")).scalar() == 1


def test_frozen_web_seeds_only_the_case_candidates(session):
    _, cases, sources = load_dataset(DATASET)
    case = next(case for case in cases if case["web_source_ids"])
    session.add(LearningPath(id="fixture-web-path", title="Fixture", input="Fixture"))
    session.flush()
    state = {
        "case": case,
        "sources": sources,
        "vectors": {id: [1.0, 0.0, 0.0] for id in sources},
        "profile": "fixture",
        "path_id": "fixture-web-path",
        "source_mapping": {},
    }
    token = runner._case_state.set(state)
    try:
        fetched, errors = runner.frozen_web_sources(session, "an arbitrary query", state["path_id"])
        assert [state["source_mapping"][item.id] for item in fetched] == case["web_source_ids"]
        assert not errors
        with pytest.raises(ValueError, match="crossed case boundaries"):
            runner.frozen_web_sources(session, "query", "another-case")
    finally:
        runner._case_state.reset(token)
