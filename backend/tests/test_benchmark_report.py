from copy import deepcopy
import csv
import json

import pytest
from markdown_it import MarkdownIt

from trellis_eval.report import write_report


def result(
    case_id,
    variant="trellis",
    *,
    status="answered",
    correctness=0.8,
    latency=2.0,
    split="test",
    category="definition",
    repetition=1,
):
    return {
        "case_id": case_id,
        "category": category,
        "split": split,
        "variant": variant,
        "repetition": repetition,
        "status": status,
        "error": "Provider unavailable" if status == "error" else None,
        "latency_seconds": latency,
        "usage": {
            "input_tokens": 100,
            "output_tokens": 20,
            "total_tokens": 120,
            "embedding_tokens": 0,
            "model_calls": 2,
            "missing_usage_calls": 0,
        },
        "judge_usage": {
            "input_tokens": 50,
            "output_tokens": 10,
            "total_tokens": 60,
            "embedding_tokens": 0,
            "model_calls": 1,
            "missing_usage_calls": 0,
        },
        "metrics": {
            "answer_correctness": {"score": correctness, "reason": "Fixture score", "error": None},
            "citation_precision": {
                "score": 1.0,
                "supported_citations": 1,
                "total_citations": 1,
                "reason": "Supported",
                "error": None,
            },
            "thread_context": {"score": None, "reason": "Not a thread case", "error": None},
            "retrieval_recall_at_3": 0.5,
            "retrieval_recall_at_5": 0.75,
            "retrieval_recall_at_8": 1.0,
            "expected_status": status == "answered",
            "citation_membership": 1.0,
        },
        "question": "What is QPS?",
        "expected_answer": "Queries per second.",
        "response": {"content": "QPS measures query throughput."},
    }


def test_correctness_and_status_coverage_keep_all_case_denominators(tmp_path):
    answered = result("supported", correctness=0.9)
    unverified = result("fallback", status="unverified", correctness=0.6)
    abstained = result("unexpected-abstention", status="abstained", correctness=0.0)
    failed = result("failed", status="error", correctness=None)
    failed["metrics"]["answer_correctness"]["error"] = "Generation failed"
    failed["metrics"]["expected_status"] = None
    summary = write_report([answered, unverified, abstained, failed], {}, tmp_path)
    aggregate = summary["variants"]["trellis"]
    assert aggregate["total_rows"] == 4
    assert aggregate["request_error_rows"] == 1
    for status in ("answered", "unverified", "abstained", "error"):
        assert aggregate["coverage"][status] == {"count": 1, "denominator": 4, "rate": 0.25}
    correctness = aggregate["metrics"]["answer_correctness"]
    assert correctness["score"] == pytest.approx(0.5)
    assert correctness == {
        "score": 0.5,
        "scored_rows": 3,
        "unscored_rows": 1,
        "error_rows": 1,
        "total_rows": 4,
    }
    assert aggregate["metrics"]["answer_correctness_source_backed"]["score"] == 0.9
    assert aggregate["metrics"]["answer_correctness_source_backed"]["total_rows"] == 1
    assert aggregate["metrics"]["answer_correctness_unverified"]["score"] == 0.6
    assert aggregate["metrics"]["expected_status"]["score"] == pytest.approx(1 / 3)
    assert aggregate["metrics"]["expected_status"]["scored_rows"] == 3
    assert aggregate["metrics"]["thread_context"]["score"] is None
    assert aggregate["metrics"]["thread_context"]["scored_rows"] == 0


def test_citation_precision_is_micro_and_excludes_failed_judgments(tmp_path):
    one = result("one-citation")
    one["metrics"]["citation_precision"].update(score=0.0, supported_citations=0)
    nine = result("nine-citations")
    nine["metrics"]["citation_precision"].update(
        score=1.0, supported_citations=9, total_citations=9
    )
    failed = result("judge-failed")
    failed["metrics"]["citation_precision"].update(
        score=1.0,
        supported_citations=2,
        total_citations=2,
        error="Judge output could not be parsed",
    )
    missing = result("judge-missing")
    missing["metrics"]["citation_precision"].update(
        score=None, supported_citations=None, total_citations=3
    )
    no_citations = result("no-citations", status="unverified")
    no_citations["metrics"]["citation_precision"].update(
        score=None, supported_citations=0, total_citations=0
    )
    summary = write_report([one, nine, failed, missing, no_citations], {}, tmp_path)
    citations = summary["variants"]["trellis"]["metrics"]["citation_precision"]
    assert citations["score"] == pytest.approx(0.9)
    assert citations["supported_citations"] == 9
    assert citations["total_citations"] == 10
    assert citations["scored_rows"] == 2
    assert citations["excluded_citations"] == 5
    assert citations["excluded_rows"] == 2
    assert citations["error_rows"] == 1
    assert citations["zero_citation_rows"] == 1
    assert citations["total_rows"] == 5


def test_unknown_usage_remains_unknown_and_judge_cost_is_separate(tmp_path):
    known = result("known")
    missing = result("partial")
    missing["usage"].update(
        input_tokens=None,
        output_tokens=None,
        total_tokens=None,
        embedding_tokens=None,
        missing_usage_calls=2,
    )
    missing["judge_usage"]["total_tokens"] = None
    aggregate = write_report([known, missing], {}, tmp_path)["variants"]["trellis"]
    product = aggregate["product_usage"]
    assert product["total_tokens"] == {
        "total": None,
        "known_partial_total": 120,
        "known_rows": 1,
        "unknown_rows": 1,
    }
    assert product["embedding_tokens"] == {
        "total": None,
        "known_partial_total": 0,
        "known_rows": 1,
        "unknown_rows": 1,
    }
    assert product["missing_usage_calls"]["total"] == 2
    assert product["model_calls"]["total"] == 4
    assert aggregate["judge_usage"]["input_tokens"]["total"] == 100
    assert aggregate["judge_usage"]["total_tokens"]["known_partial_total"] == 60
    assert aggregate["judge_usage"]["total_tokens"]["total"] is None
    assert "Unknown usage stays N/A" in (tmp_path / "report.md").read_text()


def test_split_category_and_inclusive_latency_statistics(tmp_path):
    rows = [
        result("development", "baseline", split="development", category="definition", latency=1.0),
        result("development", split="development", category="definition", latency=3.0),
        result("test", "baseline", split="test", category="thread", latency=5.0),
        result("test", split="test", category="thread", latency=9.0),
    ]
    rows[2]["metrics"]["thread_context"]["score"] = 0.4
    rows[3]["metrics"]["thread_context"]["score"] = 0.9
    summary = write_report(rows, {}, tmp_path)
    assert summary["by_split"]["test"]["trellis"]["total_rows"] == 1
    assert summary["by_category"]["definition"]["baseline"]["total_rows"] == 1
    assert summary["by_category"]["thread"]["trellis"]["metrics"]["thread_context"]["score"] == 0.9
    assert summary["by_split"]["development"]["trellis"]["latency_seconds"]["p95"] == 3.0
    assert summary["variants"]["trellis"]["latency_seconds"]["median"] == 6.0
    assert summary["variants"]["trellis"]["latency_seconds"]["p95"] == pytest.approx(8.7)
    assert summary["paired_comparisons"]["by_split"]["test"]["complete_pairs"] == 1
    assert (
        summary["paired_comparisons"]["by_category"]["thread"]["metrics"]["thread_context"][
            "difference_points"
        ]
        == 50.0
    )


def test_comparisons_use_only_unique_complete_pairs_and_per_metric_denominators(tmp_path):
    baseline = result("paired", "baseline", correctness=0.5, latency=2.0)
    trellis = result("paired", correctness=0.8, latency=1.0)
    second_baseline = result("second", "baseline", correctness=1.0)
    second_trellis = result("second", correctness=None)
    second_trellis["metrics"]["answer_correctness"]["error"] = "Judge unavailable"
    second_trellis["metrics"]["citation_precision"]["error"] = "Judge unavailable"
    rows = [
        baseline,
        trellis,
        second_baseline,
        second_trellis,
        result("unpaired", correctness=0.0),
        result("error", "baseline"),
        result("error", status="error", correctness=None),
        result("duplicate", "baseline"),
        result("duplicate"),
        result("duplicate"),
    ]
    paired = write_report(rows, {}, tmp_path)["paired_comparisons"]["overall"]
    assert paired["complete_pairs"] == 2
    assert paired["excluded_pairs"] == {
        "missing_variant": 1,
        "duplicate_variant": 1,
        "request_error": 1,
        "inconsistent_case_metadata": 0,
    }
    correctness = paired["metrics"]["answer_correctness"]
    assert correctness["paired_rows"] == 1
    assert correctness["unscored_pairs"] == 1
    assert correctness["baseline_score"] == 0.5
    assert correctness["trellis_score"] == 0.8
    assert correctness["difference_points"] == pytest.approx(30.0)
    citations = paired["metrics"]["citation_precision"]
    assert citations["paired_rows"] == 1
    assert citations["baseline_citations"]["total_citations"] == 1
    assert citations["trellis_citations"]["total_citations"] == 1
    assert citations["excluded_citations"] == {
        "baseline": {"known_citations": 1, "unknown_count_rows": 0},
        "trellis": {"known_citations": 1, "unknown_count_rows": 0},
    }
    assert paired["latency_seconds"]["paired_rows"] == 2
    assert paired["latency_seconds"]["median_difference_percent"] == -25.0


def test_repetitions_remain_separate_pairs_and_zero_latency_has_no_percent_change(tmp_path):
    rows = [
        result("case", "baseline", repetition=1, latency=0.0),
        result("case", repetition=1, latency=1.0),
        result("case", "baseline", repetition=2, latency=0.0),
        result("case", repetition=2, latency=None),
    ]
    paired = write_report(rows, {}, tmp_path)["paired_comparisons"]["overall"]
    assert paired["complete_pairs"] == 2
    assert paired["latency_seconds"]["paired_rows"] == 1
    assert paired["latency_seconds"]["median_difference_percent"] is None


def test_outputs_preserve_metadata_and_blank_human_ratings(tmp_path):
    metadata = {
        "dataset_version": "v1",
        "dataset_hash": "abc123",
        "provider": "azure",
        "model": "same-model",
        "judge_provider": "azure",
        "judge_model": "same-model",
        "review_status": "pending_human_review",
        "workers": 2,
        "git_commit": "def456",
    }
    row = result("quoted-question")
    row["question"] = 'What does "QPS" mean?\nGive an explanation.'
    row["resolved_question"] = "What does queries per second measure?"
    row["response"]["evidence"] = [
        {
            "id": "passage-one",
            "title": 'A reference about "QPS"',
            "excerpt": "QPS means queries per second.\nIt measures query throughput.",
            "url": "https://example.com/qps",
        }
    ]
    original = deepcopy(row)
    summary = write_report([row], metadata, tmp_path)
    assert row == original
    assert summary["metadata"] == metadata
    assert json.loads((tmp_path / "summary.json").read_text()) == summary
    markdown = (tmp_path / "report.md").read_text()
    assert "pending_human_review" in markdown
    assert "same model generates and judges" in markdown
    assert "not verified factual accuracy" in markdown
    assert "do not measure live web search" in markdown
    with (tmp_path / "human_review.csv").open(newline="") as handle:
        reviews = list(csv.DictReader(handle))
    assert reviews[0]["question"] == row["question"]
    assert reviews[0]["resolved_question"] == row["resolved_question"]
    assert reviews[0]["reference"] == row["expected_answer"]
    assert reviews[0]["response"] == row["response"]["content"]
    assert json.loads(reviews[0]["cited_passages"]) == row["response"]["evidence"]
    assert json.loads(reviews[0]["metrics"]) == row["metrics"]
    for column in (
        "reviewer",
        "human_answer_correctness",
        "human_citation_precision",
        "human_thread_context",
        "human_policy_correctness",
        "human_notes",
    ):
        assert reviews[0][column] == ""
    with (tmp_path / "aggregate_metrics.csv").open(newline="") as handle:
        aggregates = list(csv.DictReader(handle))
    context = next(
        row for row in aggregates if row["scope"] == "overall" and row["metric"] == "thread_context"
    )
    assert context["value"] == ""
    assert context["measured_rows"] == "0"
    assert any(row["metric"] == "latency_seconds.p95" for row in aggregates)
    assert any(row["metric"] == "product_usage.total_tokens" for row in aggregates)
    assert any(row["metric"] == "judge_usage.total_tokens" for row in aggregates)


def test_empty_run_has_no_fabricated_scores_or_usage(tmp_path):
    summary = write_report([], {}, tmp_path)
    assert summary["total_rows"] == 0
    assert summary["variants"] == {}
    assert summary["paired_comparisons"]["overall"]["complete_pairs"] == 0
    assert (
        summary["paired_comparisons"]["overall"]["metrics"]["answer_correctness"][
            "difference_points"
        ]
        is None
    )
    assert summary["paired_comparisons"]["overall"]["latency_seconds"]["baseline"]["median"] is None
    with (tmp_path / "human_review.csv").open(newline="") as handle:
        assert list(csv.DictReader(handle)) == []


def test_markdown_keeps_both_variants_in_each_metric_table(tmp_path):
    write_report([result("case", "baseline"), result("case")], {}, tmp_path)
    tokens = MarkdownIt("commonmark").enable("table").parse((tmp_path / "report.md").read_text())
    tables = []
    table = None
    for token in tokens:
        if token.type == "table_open":
            table = []
        elif token.type == "inline" and table is not None:
            table.append(token.content)
        elif token.type == "table_close":
            tables.append(table)
            table = None
    metric_tables = [table for table in tables if "Scored rows" in table]
    assert len(metric_tables) == 3
    assert all("baseline" in table and "trellis" in table for table in metric_tables)


def test_pair_metadata_mismatch_and_nonfinite_scores_are_not_compared(tmp_path):
    baseline = result("case", "baseline")
    trellis = result("case", category="thread", correctness=float("nan"))
    summary = write_report([baseline, trellis], {}, tmp_path)
    assert summary["variants"]["trellis"]["metrics"]["answer_correctness"]["score"] is None
    paired = summary["paired_comparisons"]["overall"]
    assert paired["complete_pairs"] == 0
    assert paired["excluded_pairs"]["inconsistent_case_metadata"] == 1


def test_markdown_metadata_is_compact_and_setup_usage_remains_separate(tmp_path):
    metadata = {
        "run_id": "example-run",
        "dataset_version": "1.0.0",
        "dataset_sha256": "cases-hash",
        "source_sha256": "sources-hash",
        "provider": "azure",
        "model": "chat-model",
        "judge_provider": "azure",
        "judge_model": "judge-model",
        "git_commit": "commit-id",
        "git_dirty": True,
        "split": "test",
        "workers": 2,
        "repetitions": 1,
        "expected_rows": 2,
        "complete": True,
        "started_at": "2026-09-26T10:00:00Z",
        "finished_at": "2026-09-26T10:02:00Z",
        "question_families": [{"long_dataset_detail": "kept only in full metadata"}] * 96,
        "implementation_sha256": {f"module{index}.py": "codehash" for index in range(50)},
        "setup_usage": {
            "embedding_calls": 3,
            "embedding_tokens": 4567,
            "total_tokens": 4567,
            "missing_usage_calls": 0,
        },
    }
    summary = write_report([result("case", "baseline"), result("case")], metadata, tmp_path)
    markdown = (tmp_path / "report.md").read_text()
    assert markdown.index("## Overall") < 2500
    assert "long_dataset_detail" not in markdown
    assert "module49.py" not in markdown
    assert "[Full run manifest and implementation checksums](run.json)" in markdown
    for value in ("example-run", "cases-hash", "sources-hash", "commit-id", "judge-model"):
        assert value in markdown
    assert '"recorded_rows": 2' in markdown
    assert "## Corpus embedding setup" in markdown
    assert "| 3 | 4567 | 4567 | 0 |" in markdown
    assert summary["metadata"]["question_families"] == metadata["question_families"]
    assert summary["metadata"]["implementation_sha256"] == metadata["implementation_sha256"]
    assert summary["variants"]["trellis"]["product_usage"]["total_tokens"]["total"] == 120
    assert summary["variants"]["trellis"]["judge_usage"]["total_tokens"]["total"] == 60


def test_regenerating_reports_preserves_existing_human_review(tmp_path):
    rows = [result("reviewed")]
    write_report(rows, {}, tmp_path)
    worksheet = tmp_path / "human_review.csv"
    with worksheet.open(newline="") as handle:
        reader = csv.DictReader(handle)
        columns = reader.fieldnames
        reviewed = list(reader)
    reviewed[0].update(
        reviewer="Independent reviewer",
        human_answer_correctness="0.8",
        human_notes="The definition is correct; the explanation omits one limitation.",
    )
    with worksheet.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns)
        writer.writeheader()
        writer.writerows(reviewed)
    original = worksheet.read_bytes()
    summary = write_report([*rows, result("newly-completed")], {}, tmp_path)
    assert summary["total_rows"] == 2
    assert worksheet.read_bytes() == original
    assert json.loads((tmp_path / "summary.json").read_text())["total_rows"] == 2


def test_human_review_missing_resolution_and_evidence_stay_empty(tmp_path):
    write_report([result("no-citations", status="unverified")], {}, tmp_path)
    with (tmp_path / "human_review.csv").open(newline="") as handle:
        reviewed = list(csv.DictReader(handle))
    assert reviewed[0]["resolved_question"] == ""
    assert json.loads(reviewed[0]["cited_passages"]) == []
