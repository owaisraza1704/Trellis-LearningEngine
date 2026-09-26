# Evaluation results on the homepage

The homepage reads the checked-in [benchmark snapshot](../trellis-ui/public/benchmarks/trellis-v1.json). It is a compact export of a completed evaluation run, also available to download from the page. Opening the homepage does not run an evaluation or make model calls.

Refresh it from the repository root after completing a benchmark with both variants on the full test split. Partial or `--limit` runs cannot replace the public snapshot:

```sh
python3 scripts/export_benchmark.py .data/evaluations/v1-initial-benchmark
```

Use `--output path/to/snapshot.json` to inspect a new export before replacing the homepage snapshot. The standard-library script reads only `run.json` and `summary.json`; it preserves exact scores, sample sizes, excluded judgments, token availability, and dataset hashes. It exports no prompts, source contents, local paths, or credentials.

The page's headline compares **paired test cases**, while the detailed test results retain each variant's own denominator. Keep the model-judged qualifier, review status, baseline definition, and measured latency/token trade-offs when displaying these numbers. A score of 0.905 is not 90.5% factual accuracy. The current run uses AI-authored references awaiting independent human review and fixed web fixtures rather than live searches.

Read the [initial result discussion](results/v1-initial.md) and [evaluation guide](../docs/evaluation.md) for interpretation, reproduction, and human review. Keep the full local run directory when sharing numerical claims; the public snapshot is a presentation artifact, not the complete underlying evidence.
