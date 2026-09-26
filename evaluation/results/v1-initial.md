# Initial Trellis evaluation — dataset v1

This is a **provisional, model-judged benchmark**, pending independent human review of the reference labels and judge calibration. It is not a verified factual-accuracy claim.

The run completed **192 answer executions**: 96 cases × one-pass RAG and Trellis, one repetition, four concurrent workers. Dataset v1 contains 48 development and 48 test cases across six categories, with disjoint topic families. Generation and external judging used Azure deployment `gpt-5.6-luna`; embeddings used `azure:text-embedding-3-large:3072`. Fixed curated/synthetic passages replace live web discovery. No production prompts, thresholds, or dataset labels were changed in response to this run.

## Test-split observations

Each variant ran all 48 test cases. Correctness is a graded score from 0 to 1; it is not a percentage of factually correct answers.

| Measure | One-pass RAG | Trellis |
| --- | ---: | ---: |
| Mean answer-correctness judge score | 0.636 (39 cases) | 0.907 (40 cases) |
| Model-judged citation precision | 95.1% (58/61 footer links) | 98.6% (70/71 footer links) |
| Initial retrieval recall@8 | 86.1% (36 cases) | 88.9% (36 cases) |
| Thread-resolution judge score | N/A: no separate resolver | 0.925 (8 cases) |
| Expected-status matches | 35/48 | 46/48 |
| Sourced / unverified / withheld answers | 27 / 0 / 21 | 34 / 4 / 10 |
| Median / p95 answer latency | 3.98s / 5.34s | 9.93s / 16.13s |
| Product tokens, including query embeddings | 75,799 | 233,680 |
| Product chat calls | 44 | 153 |
| Answer request errors | 0 | 0 |

Eight expected-abstention cases per variant have no correctness grade. One additional baseline correctness judgment was unavailable (`test_networking_normal_01`). On the **39 mutually scored pairs**, correctness scores were 0.636 for the baseline and 0.905 for Trellis: a 26.9-point difference in judge scores, with no statistical-significance claim.

Citation averages above include each variant's own sourced answers. Across the 27 pairs where both answered with citations, precision was 58/61 for the baseline and 58/59 for Trellis. A supported citation link does not establish support for every claim or measure citation completeness.

Trellis's additional resolution, evidence review, correction, and fallback calls increased measured latency and token use. Timings include the answer pipeline, exclude benchmark judging/corpus setup, and were observed with four concurrent workers on a development laptop. They do not measure browser or live-search performance.

For all 96 cases, Trellis used 475,847 product tokens and 154,830 external-judge tokens. Corpus setup used 4,884 embedding tokens shared by both variants. The baseline's full judge-token total is unknown because of the unavailable judgment; partial known usage is retained in the raw report rather than treated as a complete total.

## Cases requiring review

Trellis withheld three answers where the draft reference labels expect an explanation of conflicting documents: `test_sql_conflict_02`, `test_git_conflict_02`, and `dev_throughput_conflict_01`. The questions ask for a binding or definitive rule when the sources do not establish one. Review whether the product should explain the disagreement or withhold, and whether the labels correctly reflect that intended behavior, before making changes.

The same model generated and judged answers, and all reference labels are AI-authored. Human review must check attribution, correctness, conflict handling, and judge agreement. A separate engineered sanity check scored an intentionally correct answer 1.0 and a false answer 0.0 across correctness, citation support, and thread intent; this is basic discrimination testing, not human calibration.

## Evidence and reproduction

- Run ID: `20260926T035034Z-b4ec6c`; completed `2026-09-26T04:01:40.033394+00:00`.
- Dataset SHA-256: `ed15f17de1586c594d5d4fab52cec3df4ae01007a1a77bc27c1a61e3d3fc6f41`.
- Source SHA-256: `912a592b2dc1389c4c2b45068b09e09b187ef9a15fd352c4060f0e989191e6c3`.
- Starting Git commit: `35f837f093b8d9d32b635952754ff016ffd53a92` with uncommitted evaluation changes; the run stores exact implementation snapshots/checksums.
- [Full local report](../../.data/evaluations/v1-initial-benchmark/report.md), [raw results](../../.data/evaluations/v1-initial-benchmark/rows.jsonl), [human-review worksheet](../../.data/evaluations/v1-initial-benchmark/human_review.csv), and [judge sanity check](../../.data/evaluations/judge-sanity-v1.json). These files are local, gitignored artifacts; retain the complete run directory when sharing numerical claims.
- [Running and interpreting evaluations](../../docs/evaluation.md).

Verification: **160 automated backend tests passed**, lint passed, all 192 answer requests completed, and no benchmark schemas remained after cleanup. One external correctness judgment was unavailable and explicitly excluded. Frontend behavior and live search were outside this benchmark.

## Resume wording available now

> Built a DeepEval benchmark with 96 versioned cases across six scenarios, measuring answer quality, citation support, retrieval recall, conversation resolution, latency, and token usage against a one-pass RAG baseline.

Performance claims should retain their model-judged qualifier and sample sizes. Stronger factual-accuracy or improvement claims require independently reviewed references and judge calibration.
