"""Transparent aggregate reports for the local, fixture-based evaluation runner."""

from collections import Counter, defaultdict
import csv
import json
from math import isfinite
from pathlib import Path
from statistics import fmean, median, quantiles


SCORE_METRICS = (
    "answer_correctness",
    "thread_context",
    "expected_status",
    "retrieval_recall_at_3",
    "retrieval_recall_at_5",
    "retrieval_recall_at_8",
)
TOKEN_FIELDS = ("input_tokens", "output_tokens", "total_tokens", "embedding_tokens")
STATUSES = ("answered", "unverified", "abstained", "error")


def _number(value):
    return (
        value
        if isinstance(value, (int, float)) and not isinstance(value, bool) and isfinite(value)
        else None
    )


def _score(row, name):
    value = row.get("metrics", {}).get(name)
    if name == "expected_status":
        return float(value) if isinstance(value, bool) else None
    if isinstance(value, dict):
        return None if value.get("error") else _number(value.get("score"))
    return _number(value)


def _score_summary(rows, name):
    values = [value for row in rows if (value := _score(row, name)) is not None]
    errors = sum(
        isinstance(metric := row.get("metrics", {}).get(name), dict) and bool(metric.get("error"))
        for row in rows
    )
    return {
        "score": fmean(values) if values else None,
        "scored_rows": len(values),
        "unscored_rows": len(rows) - len(values),
        "error_rows": errors,
        "total_rows": len(rows),
    }


def _citation_summary(rows):
    supported = total = scored_rows = excluded_rows = excluded_citations = error_rows = 0
    zero_citation_rows = missing_count_rows = 0
    for row in rows:
        metric = row.get("metrics", {}).get("citation_precision") or {}
        count = _number(metric.get("total_citations"))
        support = _number(metric.get("supported_citations"))
        failed = bool(metric.get("error"))
        error_rows += failed
        if count is None:
            missing_count_rows += 1
            excluded_rows += 1
        elif failed or (
            count > 0 and (_score(row, "citation_precision") is None or support is None)
        ):
            excluded_rows += 1
            excluded_citations += count
        elif count == 0:
            zero_citation_rows += 1
        else:
            total += count
            supported += support
            scored_rows += 1
    return {
        "score": supported / total if total else None,
        "supported_citations": supported,
        "total_citations": total,
        "scored_rows": scored_rows,
        "excluded_rows": excluded_rows,
        "excluded_citations": excluded_citations,
        "error_rows": error_rows,
        "zero_citation_rows": zero_citation_rows,
        "missing_count_rows": missing_count_rows,
        "total_rows": len(rows),
    }


def _usage_summary(rows, field):
    usages = [row.get(field) or {} for row in rows]
    summary = {}
    for name in (*TOKEN_FIELDS, "model_calls", "missing_usage_calls"):
        known = [value for usage in usages if (value := _number(usage.get(name))) is not None]
        summary[name] = {
            "total": sum(known) if known and len(known) == len(rows) else None,
            "known_partial_total": sum(known) if known else None,
            "known_rows": len(known),
            "unknown_rows": len(rows) - len(known),
        }
    return summary


def _latency_summary(rows):
    values = [value for row in rows if (value := _number(row.get("latency_seconds"))) is not None]
    return {
        "median": median(values) if values else None,
        "p95": quantiles(values, n=100, method="inclusive")[94]
        if len(values) > 1
        else (values[0] if values else None),
        "measured_rows": len(values),
        "missing_rows": len(rows) - len(values),
    }


def _aggregate(rows):
    counts = Counter(row["status"] for row in rows)
    metrics = {name: _score_summary(rows, name) for name in SCORE_METRICS}
    metrics["citation_precision"] = _citation_summary(rows)
    metrics["answer_correctness_source_backed"] = _score_summary(
        [row for row in rows if row["status"] == "answered"],
        "answer_correctness",
    )
    metrics["answer_correctness_unverified"] = _score_summary(
        [row for row in rows if row["status"] == "unverified"],
        "answer_correctness",
    )
    return {
        "total_rows": len(rows),
        "coverage": {
            status: {
                "count": counts[status],
                "denominator": len(rows),
                "rate": counts[status] / len(rows) if rows else None,
            }
            for status in STATUSES
        },
        "request_error_rows": sum(
            row["status"] == "error" or bool(row.get("error")) for row in rows
        ),
        "metrics": metrics,
        "latency_seconds": _latency_summary(rows),
        "product_usage": _usage_summary(rows, "usage"),
        "judge_usage": _usage_summary(rows, "judge_usage"),
    }


def _paired_comparison(rows):
    grouped = defaultdict(lambda: defaultdict(list))
    for row in rows:
        grouped[(row["case_id"], row["repetition"])][row["variant"]].append(row)
    pairs = []
    exclusions = {
        "missing_variant": 0,
        "duplicate_variant": 0,
        "request_error": 0,
        "inconsistent_case_metadata": 0,
    }
    for variants in grouped.values():
        if any(len(variants.get(variant, [])) > 1 for variant in ("baseline", "trellis")):
            exclusions["duplicate_variant"] += 1
            continue
        if not all(variants.get(variant) for variant in ("baseline", "trellis")):
            exclusions["missing_variant"] += 1
            continue
        baseline, trellis = variants["baseline"][0], variants["trellis"][0]
        if any(row["status"] == "error" or row.get("error") for row in (baseline, trellis)):
            exclusions["request_error"] += 1
            continue
        if any(baseline[field] != trellis[field] for field in ("split", "category")):
            exclusions["inconsistent_case_metadata"] += 1
            continue
        pairs.append((baseline, trellis))
    metrics = {}
    for name in SCORE_METRICS:
        scored = [
            (left, right)
            for baseline, trellis in pairs
            if (left := _score(baseline, name)) is not None
            and (right := _score(trellis, name)) is not None
        ]
        left = fmean(value[0] for value in scored) if scored else None
        right = fmean(value[1] for value in scored) if scored else None
        metrics[name] = {
            "baseline_score": left,
            "trellis_score": right,
            "difference_points": (right - left) * 100 if scored else None,
            "paired_rows": len(scored),
            "unscored_pairs": len(pairs) - len(scored),
        }
    citation_pairs = [
        (baseline, trellis)
        for baseline, trellis in pairs
        if _citation_summary([baseline])["score"] is not None
        and _citation_summary([trellis])["score"] is not None
    ]
    baseline_citations = _citation_summary([pair[0] for pair in citation_pairs])
    trellis_citations = _citation_summary([pair[1] for pair in citation_pairs])
    excluded_citation_pairs = [pair for pair in pairs if pair not in citation_pairs]
    excluded_citations = {}
    for index, variant in enumerate(("baseline", "trellis")):
        counts = [
            _number(
                (pair[index].get("metrics", {}).get("citation_precision") or {}).get(
                    "total_citations"
                )
            )
            for pair in excluded_citation_pairs
        ]
        excluded_citations[variant] = {
            "known_citations": sum(count for count in counts if count is not None),
            "unknown_count_rows": sum(count is None for count in counts),
        }
    metrics["citation_precision"] = {
        "baseline_score": baseline_citations["score"],
        "trellis_score": trellis_citations["score"],
        "difference_points": (trellis_citations["score"] - baseline_citations["score"]) * 100
        if citation_pairs
        else None,
        "paired_rows": len(citation_pairs),
        "unscored_pairs": len(pairs) - len(citation_pairs),
        "baseline_citations": baseline_citations,
        "trellis_citations": trellis_citations,
        "excluded_citations": excluded_citations,
    }
    timed = [
        (baseline, trellis)
        for baseline, trellis in pairs
        if _number(baseline.get("latency_seconds")) is not None
        and _number(trellis.get("latency_seconds")) is not None
    ]
    baseline_latency = _latency_summary([pair[0] for pair in timed])
    trellis_latency = _latency_summary([pair[1] for pair in timed])
    baseline_median, trellis_median = baseline_latency["median"], trellis_latency["median"]
    return {
        "case_repetition_keys": len(grouped),
        "complete_pairs": len(pairs),
        "excluded_pairs": exclusions,
        "metrics": metrics,
        "latency_seconds": {
            "baseline": baseline_latency,
            "trellis": trellis_latency,
            "paired_rows": len(timed),
            "median_difference_percent": (trellis_median - baseline_median) / baseline_median * 100
            if baseline_median
            else None,
        },
    }


def _format(value, digits=3):
    return "N/A" if value is None else f"{value:.{digits}f}"


def _markdown(summary):
    metadata = summary["metadata"]
    compact_metadata = {
        key: metadata[key]
        for key in (
            "run_id",
            "dataset_version",
            "dataset_sha256",
            "source_sha256",
            "provider",
            "model",
            "judge_provider",
            "judge_model",
            "embedding_profile",
            "git_commit",
            "git_dirty",
            "split",
            "category",
            "selected_case_count",
            "repetitions",
            "workers",
            "seed",
            "variants",
            "expected_rows",
            "complete",
            "started_at",
            "finished_at",
            "review_status",
        )
        if key in metadata
    }
    compact_metadata["recorded_rows"] = summary["total_rows"]
    lines = ["# Trellis offline evaluation", "", "## Limitations", ""]
    lines.extend(f"- {limitation}" for limitation in summary["limitations"])
    lines.extend(
        [
            "",
            "## Run metadata",
            "",
            "```json",
            json.dumps(compact_metadata, indent=2, ensure_ascii=False),
            "```",
            "",
            "[Full run manifest and implementation checksums](run.json). "
            "Complete metadata also remains in `summary.json`.",
            "",
        ]
    )
    groups = [("Overall", summary["variants"])]
    groups.extend((f"Split: {name}", variants) for name, variants in summary["by_split"].items())
    groups.extend(
        (f"Category: {name}", variants) for name, variants in summary["by_category"].items()
    )
    for title, variants in groups:
        lines.extend(
            [
                f"## {title}",
                "",
                "| Variant | Rows | Answered | Unverified | Abstained | Errors |",
                "| --- | ---: | ---: | ---: | ---: | ---: |",
            ]
        )
        for variant, aggregate in variants.items():
            counts = [str(aggregate["coverage"][status]["count"]) for status in STATUSES]
            lines.append(f"| {variant} | {aggregate['total_rows']} | " + " | ".join(counts) + " |")
        lines.extend(
            [
                "",
                "Every coverage count uses the variant's total row count as its denominator.",
                "",
                "| Variant | Metric | Score | Scored rows | Total rows | Metric errors |",
                "| --- | --- | ---: | ---: | ---: | ---: |",
            ]
        )
        for variant, aggregate in variants.items():
            for name, metric in aggregate["metrics"].items():
                lines.append(
                    f"| {variant} | {name} | {_format(metric['score'])} | {metric['scored_rows']} | {metric['total_rows']} | {metric['error_rows']} |"
                )
        lines.append("")
        for variant, aggregate in variants.items():
            citations = aggregate["metrics"]["citation_precision"]
            lines.extend(
                [
                    "",
                    f"{variant} citation precision: {citations['supported_citations']}/{citations['total_citations']} judged citations; {citations['excluded_citations']} citations excluded in {citations['excluded_rows']} rows; {citations['zero_citation_rows']} rows had no citations; {citations['missing_count_rows']} rows have unknown citation counts.",
                    "",
                ]
            )
        lines.extend(
            [
                "| Variant | Median seconds | P95 seconds | Measured rows | Missing rows |",
                "| --- | ---: | ---: | ---: | ---: |",
            ]
        )
        for variant, aggregate in variants.items():
            latency = aggregate["latency_seconds"]
            lines.append(
                f"| {variant} | {_format(latency['median'])} | {_format(latency['p95'])} | {latency['measured_rows']} | {latency['missing_rows']} |"
            )
        lines.append("")
    setup = metadata.get("setup_usage") or {}
    lines.extend(
        [
            "## Corpus embedding setup",
            "",
            "One-time corpus setup is shared across variants. It is separate from per-answer "
            "product usage and external judge overhead, and excluded from answer latency. "
            "N/A means the provider count was unavailable or setup usage was not recorded.",
            "",
            "| Embedding calls | Embedding tokens | Total setup tokens | Missing-usage calls |",
            "| ---: | ---: | ---: | ---: |",
            "| "
            + " | ".join(
                _format(setup.get(field), 0)
                for field in (
                    "embedding_calls",
                    "embedding_tokens",
                    "total_tokens",
                    "missing_usage_calls",
                )
            )
            + " |",
            "",
        ]
    )
    lines.extend(
        [
            "## Product usage and judge overhead",
            "",
            "Unknown usage stays N/A. Known partial totals are not complete run totals. Product usage includes the application pipeline; judge usage is separate benchmark overhead.",
            "",
            "| Variant | Usage | Field | Complete total | Known partial total | Known rows | Unknown rows |",
            "| --- | --- | --- | ---: | ---: | ---: | ---: |",
        ]
    )
    for variant, aggregate in summary["variants"].items():
        for usage_name in ("product_usage", "judge_usage"):
            for field, usage in aggregate[usage_name].items():
                lines.append(
                    f"| {variant} | {usage_name} | {field} | {_format(usage['total'], 0)} | {_format(usage['known_partial_total'], 0)} | {usage['known_rows']} | {usage['unknown_rows']} |"
                )
    paired = summary["paired_comparisons"]["overall"]
    lines.extend(
        [
            "",
            "## Paired comparisons",
            "",
            f"{paired['complete_pairs']} complete case/repetition pairs; exclusions: {json.dumps(paired['excluded_pairs'])}.",
            "",
            "Differences are Trellis minus baseline. Quality differences are score percentage points, not verified accuracy changes. Latency differences describe this run only; negative values mean lower observed latency.",
            "",
            "| Metric | Baseline | Trellis | Difference points | Paired rows | Unscored pairs |",
            "| --- | ---: | ---: | ---: | ---: | ---: |",
        ]
    )
    for name, metric in paired["metrics"].items():
        lines.append(
            f"| {name} | {_format(metric['baseline_score'])} | {_format(metric['trellis_score'])} | {_format(metric['difference_points'])} | {metric['paired_rows']} | {metric['unscored_pairs']} |"
        )
    citations = paired["metrics"]["citation_precision"]
    lines.extend(
        [
            "",
            "Paired citation comparisons exclude both sides when either side lacks a usable judgment. "
            f"Excluded citation counts: {json.dumps(citations['excluded_citations'])}.",
        ]
    )
    latency = paired["latency_seconds"]
    lines.extend(
        [
            "",
            f"Observed paired median latency: baseline {_format(latency['baseline']['median'])} s; Trellis {_format(latency['trellis']['median'])} s; difference {_format(latency['median_difference_percent'], 2)}% across {latency['paired_rows']} timed pairs.",
            "",
            "Retrieval recall is source-level recall over initial retrieval, before evidence supplementation. Correctness includes every scored case, including scored abstentions; answered and unverified subsets are also reported separately. Citation precision is a micro-average of supported citations over judged citations, excluding judge failures from both counts. P95 uses inclusive sample quantiles. Aggregate latency includes measured failed requests; paired comparisons exclude failed or incomplete requests.",
            "",
            "Review individual examples in `human_review.csv`. New worksheets leave human ratings blank; existing worksheets are preserved when reports are rebuilt. Automatic scores do not constitute human review.",
            "",
        ]
    )
    return "\n".join(lines)


def write_report(rows: list[dict], metadata: dict, output_dir: Path) -> dict:
    """Write aggregates and a human review worksheet without treating unknowns as zero."""
    variants = sorted({row["variant"] for row in rows})
    by_split = {}
    by_category = {}
    paired_by_split = {}
    paired_by_category = {}
    for field, aggregates, comparisons in (
        ("split", by_split, paired_by_split),
        ("category", by_category, paired_by_category),
    ):
        for value in sorted({row[field] for row in rows}):
            subset = [row for row in rows if row[field] == value]
            aggregates[value] = {
                variant: _aggregate([row for row in subset if row["variant"] == variant])
                for variant in variants
            }
            comparisons[value] = _paired_comparison(subset)
    review_status = metadata.get("review_status", "pending_human_review")
    limitations = [
        f"Reference facts and relevance labels are AI-authored; review status: {review_status}. Results remain provisional until human review.",
        "Model judges provide evaluation signals, not verified factual accuracy. Judge failures are reported as missing scores, not successes or zero scores.",
        "Citation precision measures support for app-rendered citation footer links, not coverage of every answer claim or numeric markers inside prose. Rows without citation links have no citation denominator.",
        "Retrieval uses frozen web fixtures. These timings do not measure live web search or page-fetch speed.",
        "Observed differences describe this dataset and run configuration only; they are not general performance claims or statistical significance findings.",
    ]
    if (
        metadata.get("model")
        and metadata.get("model") == metadata.get("judge_model")
        and metadata.get("provider") == metadata.get("judge_provider")
    ):
        limitations.insert(
            2,
            "The same model generates and judges answers; correlated errors and self-preference may bias scores.",
        )
    summary = {
        "metadata": {**metadata, "review_status": review_status},
        "limitations": limitations,
        "total_rows": len(rows),
        "variants": {
            variant: _aggregate([row for row in rows if row["variant"] == variant])
            for variant in variants
        },
        "by_split": by_split,
        "by_category": by_category,
        "paired_comparisons": {
            "overall": _paired_comparison(rows),
            "by_split": paired_by_split,
            "by_category": paired_by_category,
        },
        "artifacts": {
            "summary": "summary.json",
            "markdown": "report.md",
            "aggregates": "aggregate_metrics.csv",
            "human_review": "human_review.csv",
        },
    }
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "summary.json").write_text(
        json.dumps(summary, indent=2, ensure_ascii=False, allow_nan=False) + "\n", encoding="utf-8"
    )
    (output_dir / "report.md").write_text(_markdown(summary), encoding="utf-8")
    with (output_dir / "aggregate_metrics.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(
            (
                "scope",
                "group",
                "variant",
                "metric",
                "value",
                "unit",
                "measured_rows",
                "total_rows",
                "error_rows",
                "numerator",
                "denominator",
                "excluded_count",
                "excluded_rows",
                "known_partial_total",
                "unknown_rows",
            )
        )
        groups = [("overall", "all", summary["variants"])]
        groups.extend(("split", name, values) for name, values in by_split.items())
        groups.extend(("category", name, values) for name, values in by_category.items())
        for scope, group, aggregates in groups:
            for variant, aggregate in aggregates.items():
                for name, metric in aggregate["metrics"].items():
                    writer.writerow(
                        (
                            scope,
                            group,
                            variant,
                            name,
                            metric["score"],
                            "score_0_to_1",
                            metric["scored_rows"],
                            metric["total_rows"],
                            metric["error_rows"],
                            metric.get("supported_citations"),
                            metric.get("total_citations"),
                            metric.get("excluded_citations"),
                            metric.get("excluded_rows"),
                            None,
                            metric.get("unscored_rows"),
                        )
                    )
                for status, coverage in aggregate["coverage"].items():
                    writer.writerow(
                        (
                            scope,
                            group,
                            variant,
                            f"coverage.{status}",
                            coverage["rate"],
                            "fraction",
                            aggregate["total_rows"],
                            aggregate["total_rows"],
                            None,
                            coverage["count"],
                            coverage["denominator"],
                            None,
                            None,
                            None,
                            0,
                        )
                    )
                latency = aggregate["latency_seconds"]
                for percentile in ("median", "p95"):
                    writer.writerow(
                        (
                            scope,
                            group,
                            variant,
                            f"latency_seconds.{percentile}",
                            latency[percentile],
                            "seconds",
                            latency["measured_rows"],
                            aggregate["total_rows"],
                            aggregate["request_error_rows"],
                            None,
                            None,
                            None,
                            None,
                            None,
                            latency["missing_rows"],
                        )
                    )
                for usage_name in ("product_usage", "judge_usage"):
                    for field, usage in aggregate[usage_name].items():
                        writer.writerow(
                            (
                                scope,
                                group,
                                variant,
                                f"{usage_name}.{field}",
                                usage["total"],
                                "tokens" if field in TOKEN_FIELDS else "calls",
                                usage["known_rows"],
                                aggregate["total_rows"],
                                None,
                                None,
                                None,
                                None,
                                None,
                                usage["known_partial_total"],
                                usage["unknown_rows"],
                            )
                        )
    review_path = output_dir / "human_review.csv"
    if not review_path.exists():
        with review_path.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.writer(handle)
            writer.writerow(
                (
                    "case_id",
                    "category",
                    "split",
                    "variant",
                    "repetition",
                    "status",
                    "error",
                    "question",
                    "resolved_question",
                    "reference",
                    "response",
                    "cited_passages",
                    "metrics",
                    "reviewer",
                    "human_answer_correctness",
                    "human_citation_precision",
                    "human_thread_context",
                    "human_policy_correctness",
                    "human_notes",
                )
            )
            for row in rows:
                response = row.get("response") or {}
                writer.writerow(
                    (
                        row["case_id"],
                        row["category"],
                        row["split"],
                        row["variant"],
                        row["repetition"],
                        row["status"],
                        row.get("error"),
                        row.get("question"),
                        row.get("resolved_question", ""),
                        row.get("expected_answer"),
                        response.get("content", ""),
                        json.dumps(response.get("evidence", []), ensure_ascii=False),
                        json.dumps(row.get("metrics", {}), ensure_ascii=False),
                        "",
                        "",
                        "",
                        "",
                        "",
                        "",
                    )
                )
    return summary
