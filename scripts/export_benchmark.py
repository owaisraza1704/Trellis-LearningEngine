"""Export a completed local evaluation run for the homepage, without model calls."""

import argparse
import json
from pathlib import Path


def export_benchmark(run_directory: Path, output: Path) -> None:
    run = json.loads((run_directory / "run.json").read_text())
    summary = json.loads((run_directory / "summary.json").read_text())
    if not run["complete"] or summary["total_rows"] != run["expected_rows"]:
        raise ValueError("Only completed evaluation runs can be published.")
    if summary["metadata"]["run_id"] != run["run_id"]:
        raise ValueError("The summary and run metadata belong to different runs.")

    expected_test_rows = run["split_counts"]["test"] * run["repetitions"]
    paired = summary["paired_comparisons"]["by_split"]["test"]
    if paired["complete_pairs"] != expected_test_rows or any(
        summary["by_split"]["test"][variant]["total_rows"] != expected_test_rows
        for variant in ("baseline", "trellis")
    ):
        raise ValueError("The homepage requires both variants on the full test split.")

    test_results = {}
    for variant in ("baseline", "trellis"):
        result = summary["by_split"]["test"][variant]
        test_results[variant] = {
            "total_rows": result["total_rows"],
            "coverage": result["coverage"],
            "request_error_rows": result["request_error_rows"],
            "metrics": {
                name: result["metrics"][name]
                for name in (
                    "answer_correctness",
                    "citation_precision",
                    "retrieval_recall_at_8",
                    "thread_context",
                    "expected_status",
                )
            },
            "latency_seconds": result["latency_seconds"],
            "product_usage": {
                name: result["product_usage"][name]
                for name in ("total_tokens", "model_calls")
            },
        }

    snapshot = {
        "schema_version": 1,
        "title": "Trellis evidence benchmark",
        "run": {
            "id": run["run_id"],
            "finished_at": run["finished_at"],
            "executions": summary["total_rows"],
            "provider": run["provider"],
            "model": run["model"],
            "judge_provider": run["judge_provider"],
            "judge_model": run["judge_model"],
            "embedding_profile": run["embedding_profile"],
            "workers": run["workers"],
            "repetitions": run["repetitions"],
        },
        "dataset": {
            "id": run["dataset_id"],
            "version": run["dataset_version"],
            "total_cases": run["case_count"],
            "dev_cases": run["split_counts"]["dev"],
            "test_cases": run["split_counts"]["test"],
            "category_counts": run["category_counts"],
            "dataset_sha256": run["dataset_sha256"],
            "source_sha256": run["source_sha256"],
        },
        "methodology": {
            "framework": f"DeepEval {run['packages']['deepeval']}",
            "baseline": run["baseline"],
            "source_policy": run["source_policy"],
            "latency_scope": run["latency_scope"],
            "token_scope": run["token_scope"],
            "review_status": run["review_status"],
            "human_reviewed": run["human_reviewed"],
            "same_model_judge": (
                run["provider"] == run["judge_provider"]
                and run["model"] == run["judge_model"]
            ),
        },
        "paired_correctness": paired["metrics"]["answer_correctness"],
        "paired_citations": paired["metrics"]["citation_precision"],
        "test": test_results,
        "limitations": summary["limitations"],
        "metric_notes": {
            "answer_correctness": (
                "A graded 0–1 LLM-judge score, not a factual-accuracy percentage. "
                "Expected abstentions have no correctness grade; unavailable "
                "judgments are excluded and counted as errors. Paired correctness "
                "uses only cases scored for both variants."
            ),
            "citation_precision": (
                "Supported footer citation links divided by judged links. Each "
                "variant's full-test score uses its own cited answers; paired "
                "citation scores use only mutually eligible cases. This does not "
                "measure support for every claim."
            ),
            "retrieval_recall_at_8": (
                "Mean fraction of known relevant passages found in the initial "
                "top-eight retrieval. Cases without relevant-passage labels are "
                "excluded. Later evidence supplementation is not included."
            ),
            "thread_context": (
                "LLM-judged agreement between the resolved follow-up and its "
                "expected intent. The baseline has no separate resolver and "
                "receives no score for this metric."
            ),
            "coverage": (
                "Answered means sourced; unverified means labelled general "
                "knowledge; abstained means withheld. Expected-status agreement "
                "measures the response type, not the correctness of its content."
            ),
        },
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(snapshot, indent=2, ensure_ascii=False) + "\n")
    print(f"Exported {run['run_id']} to {output}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("run_directory", type=Path)
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).resolve().parents[1]
        / "trellis-ui/public/benchmarks/trellis-v1.json",
    )
    arguments = parser.parse_args()
    export_benchmark(arguments.run_directory, arguments.output)
