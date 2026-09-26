# Evaluating Trellis locally

Trellis includes a versioned evaluation runner for comparing a one-pass RAG baseline with the full answer pipeline. It uses the real configured models, query embeddings, PostgreSQL/pgvector retrieval, and answer checks against a fixed reference dataset.

**The dataset and its reference labels are AI-authored and pending independent human review.** Model-judge scores are provisional evaluation signals, not verified accuracy or a release-readiness guarantee. This guide describes how to run and interpret the benchmark; measured results belong to a specific saved run.

The [initial 192-run comparison](../evaluation/results/v1-initial.md) records the first measured results, exclusions, and trade-offs.

## Setup and first run

Run the CLI from `backend/`. It needs the local PostgreSQL service, the existing server `.env`, and working chat and embedding models. The frontend and API server do not need to be running.

From the repository root:

```sh
docker compose up -d --wait db
cd backend
uv sync --locked --group evaluation
.venv/bin/alembic upgrade head
.venv/bin/python -m trellis_eval validate
```

The optional `evaluation` dependency group pins **DeepEval 4.2.6**. It is not required to run the learning application. DeepEval supplies GEval through the existing Trellis provider connection; the evaluator disables DeepEval telemetry and hosted dashboard integration. Reports stay in local files. Configured remote chat, embedding, and judge providers still receive the benchmark material and incur their usual usage. Ollama can serve those roles locally when suitable models are installed.

Start with a small development run:

```sh
.venv/bin/python -m trellis_eval run \
  --split dev \
  --limit 4 \
  --workers 1 \
  --output ../.data/evaluations/dev-smoke
```

Choose a new output directory for each run; the runner refuses to overwrite an existing one. Omitting `--output` creates a unique directory under `.data/evaluations/`.

After choosing prompts and settings using development cases, run the test split:

```sh
.venv/bin/python -m trellis_eval run \
  --split test \
  --variants baseline trellis \
  --repetitions 2 \
  --workers 1 \
  --output ../.data/evaluations/test-v1
```

This selects 48 test cases and produces up to **192 result rows**: 48 cases × two variants × two repetitions. A result row can require several generation, evaluation, and per-citation judge calls; the row count is not an API-call count.

The runner creates a disposable database schema and separate learning context for each case execution. It reads the configured provider/model choice from the workspace but does not use learner journeys, uploaded material, or private conversation history. Normal completion and handled failures remove the temporary schema. The learning database is not reset.

## CLI options

| Command or option | Behavior |
| --- | --- |
| `validate [--dataset PATH]` | Checks dataset structure, IDs, counts, source membership, and split integrity; prints checksums without calling models. |
| `run --dataset PATH` | Uses another dataset directory containing `manifest.json`, `cases.jsonl`, and `sources.jsonl`. The default is `evaluation/datasets/v1`. |
| `--split dev\|test\|all` | Defaults to `test`. Use `dev` for iteration; `all` combines both splits and is not a held-out result. |
| `--category NAME` | Filters to `normal`, `followup`, `comparison`, `conflict`, `missing_evidence`, or `source_constraint`. |
| `--limit N` | Takes at most N cases after filtering and seeded shuffling. |
| `--repetitions N` | Runs each selected case/variant N times; defaults to one. |
| `--workers N` | Concurrent case executions; defaults to one. |
| `--seed N` | Controls case ordering before limiting; defaults to 17. It does not make model output deterministic. |
| `--variants baseline trellis` | Both are selected by default. A single variant is useful for diagnostics but cannot produce paired comparisons. |
| `--provider`, `--model` | Override the configured generation provider/model. Providers are `azure`, `openai`, `openrouter`, and `ollama`. Azure model names are deployment names. |
| `--judge-provider`, `--judge-model` | Select the external benchmark judge. By default it uses the generation provider/model. |
| `report DIRECTORY` | Rebuilds aggregate files from that run's `run.json` and `rows.jsonl`, without additional model calls. |

Embedding configuration remains the application's `EMBEDDING_*` settings, including Azure embedding deployment/dimension defaults. Selecting a different chat model does not change the embedding model.

For example, with the corresponding deployments configured:

```sh
.venv/bin/python -m trellis_eval run \
  --split dev --limit 4 \
  --provider azure --model YOUR_CHAT_DEPLOYMENT \
  --judge-provider azure --judge-model YOUR_JUDGE_DEPLOYMENT
```

There is no execution-resume flag. Completed rows are flushed to `rows.jsonl`; `report` can summarize them, but it does not execute missing cases. Start a new run to repeat an interrupted experiment. Rebuilding reports preserves an existing human-review worksheet.

## Dataset and holdout policy

[Dataset v1](../evaluation/datasets/v1/README.md) contains **96 cases**, split into **48 development and 48 test cases**, with eight cases per category in each split:

| Category | What it exercises |
| --- | --- |
| `normal` | Supported definitions and explanations, including eight cases whose relevant passage requires fixed web supplementation. |
| `followup` | Elliptical follow-ups and explicit topic changes within conversation context. |
| `comparison` | Questions requiring facts about more than one concept. |
| `conflict` | Conflicting documents where the response should expose both claims and the lack of an authoritative resolution. |
| `missing_evidence` | Unavailable project facts and general-knowledge fallback when neither supplied nor fixed web evidence can support an answer. |
| `source_constraint` | Supplied-source priority and requests about unavailable documents. |

The 80 source passages comprise 64 supplied-source fixtures and 16 web fixtures. Forty are short AI-authored paraphrases with public attribution URLs; forty are fictional exercise material. **They are not fetched documentation snapshots.** URLs identify review targets, not proof that a page was read or verified. Web fixtures are fixed local strings; the benchmark replaces discovery with those candidate passages while retaining real embeddings, ranking, and generation. A recorded web-search flag therefore describes the simulated fallback branch, not a live web request.

The split separates topic families and source IDs. Development topics are Python collections, HTTP caching, throughput/scaling, and Python concurrency. Test topics are SQL, Git, message delivery, and networking. This reduces direct paraphrase leakage, but the public test set is not secret or blinded. If test outcomes influence prompt or threshold changes, record that exposure and introduce fresh topic families in a new test version before claiming an untouched holdout.

Expected answers describe required facts and limitations, not exact wording. The dataset allows `answered` for 72 cases, `abstained` for 16, and `unverified` for eight. Twenty-four cases have no positive retrieval gold and are excluded from recall averages. See the dataset README for per-case fields, attribution, and the reference-review procedure.

## What the variants compare

Both variants use the same generation model, scoped history, available starting material, embedding profile, and pgvector ranking. Reference answers, relevant-source labels, and expected statuses are reserved for scoring; they are not given to the answer writer.

- **Baseline:** retrieves using the original question and produces one cited draft. It checks that referenced passage IDs belong to the retrieved evidence. It can use the shared initial-retrieval fallback, but has no separate question resolver, semantic grounding review, corrective generation, gap-driven supplementation, or general-knowledge fallback.
- **Trellis:** runs the application's full `ai.answer` path, including contextual question resolution, evidence-first generation, source checks, bounded supplementation/correction, preservation of a supported partial answer, and labelled general knowledge where policy permits it.

The baseline is a controlled one-pass RAG comparison, not an earlier released Trellis version or another vendor's product. Differences reflect the combined pipeline behavior; this comparison alone cannot attribute a change to one component.

## Scores, denominators, and failures

| Measure | Definition and limits |
| --- | --- |
| Answer correctness | GEval compares the response with the case's expected factual core and limitations, producing a score from 0 to 1. This is semantic model judging, not exact matching or verified factual accuracy. |
| Citation precision | `supported footer links / judged footer links`. A link is supported when its own cited excerpt supports at least one substantive factual claim, example, or code statement in its associated answer block. |
| Thread context | GEval compares Trellis's resolved standalone question with the expected conversational intent. This measures resolver output, not all context handling or semantic/security isolation. The baseline has no standalone resolver and receives N/A. |
| Retrieval recall @3, @5, @8 | `number of relevant source IDs in the first k initial results / number of gold source IDs`. Computed per case, then averaged over cases with a defined denominator. |
| Expected-status policy | `response.status in expected_statuses`, aggregated as the fraction of rows matching the allowed status. It checks the outcome label; it does not prove that abstention prose, uncertainty, or attribution is correct. |
| Coverage | Counts and fractions of `answered`, `unverified`, `abstained`, and `error`, each using all variant rows as its denominator. |

Citation precision recognizes Trellis's **citation-only footer lines**, such as `[1] [2]`, and associates them with the preceding Markdown block. It does not extract arbitrary numeric markers embedded in prose. Repeated links in separate blocks are separate judgments. The aggregate is a micro-average: sum supported links and divide by sum judged links, rather than averaging each answer's precision. A correct link does not establish support for every claim, citation completeness, or source quality.

If any citation judgment fails for an answer, its citation score is unavailable and that answer's links are excluded from both numerator and denominator. Reports show excluded rows/citations and rows with unknown counts. Answers with no footer links have no aggregate citation denominator; high precision can coexist with poor citation coverage.

Unexpected abstention on a case requiring a substantive answer gets correctness zero. Cases where abstention is expected receive correctness N/A and are assessed by the status-policy check. Correctness aggregates retain all available case scores, with separate `answered` and `unverified` subsets. Judge errors yield missing scores, not fabricated zero or successful scores. Reports expose scored, unscored, and error counts; a high average based on a small surviving subset needs caution.

Recall uses the **first retrieval call**, before later gap-driven supplementation. Frozen web evidence may already be present when initial retrieval itself takes the fallback branch. Later successful research does not retroactively increase initial recall. Each fixture is one source passage, so source IDs are the relevance unit. Missing gold or an unavailable initial retrieval gives N/A; a completed retrieval with positive gold but no relevant results gives zero. Recall does not measure extraction, long-document chunking, or live web-search quality.

These external benchmark metrics are separate from Trellis's internal relevance, completeness, consistency, and grounding gate. Keep internal gate decisions, external judge scores, and human review distinct when diagnosing an answer.

## Latency, tokens, and comparison scope

Per-row latency starts after case setup and ends when the answer service returns. It includes query embeddings and all internal generation, checking, correction, and fallback calls. It excludes corpus embedding, case/database setup, the external benchmark judge, and report generation. It is not browser latency, streaming first-token latency, or live web-search latency.

Reports show median and P95 seconds with measured/missing row counts. P95 uses inclusive sample quantiles; for a single observation it equals that observation. Aggregate latency includes measured error requests. Paired comparisons exclude failed requests, missing counterparts, duplicate variant rows, and inconsistent case metadata. Each metric then uses only pairs with scores on both sides.

Quality point differences are `100 × (Trellis score − baseline score)`. Observed median latency difference is `100 × (Trellis median − baseline median) / baseline median`; negative values mean lower latency in that run. A zero or unavailable baseline median gives N/A. These are descriptive differences, without confidence intervals or a statistical significance claim.

Use the same worker count and model configuration for comparable runs. Additional workers overlap model calls and may introduce quota pressure, provider queueing, or CPU/database contention. Repetitions expose some variability; they do not turn these small samples into production load tests. The seed fixes case selection/order, not provider responses or concurrent completion order.

Usage comes from provider responses, not estimated text lengths:

- `input_tokens` and `output_tokens` are chat tokens. `total_tokens` includes reported chat and embedding totals; `embedding_tokens` is that total's embedding component and should not be added again.
- `model_calls` counts chat calls; raw usage also records embedding calls. Failed attempts can have unknown token usage. Rejected structured responses can still have consumed tokens.
- Product usage covers the answer pipeline. External judge usage is separate overhead; corpus embedding is recorded separately as `setup_usage` in `run.json`.
- Missing token values stay unknown. Aggregate complete totals become N/A when a row lacks usage; known partial totals and known/unknown row counts remain available. Unknown is not zero.

By default the same model generates and judges answers. Shared errors, stylistic preferences, and self-preference can bias results; AI-authored references add another source of correlated bias. A different judge model can reduce some coupling, but it does not replace human calibration.

## Reports, review, and reproducibility

Each run directory contains:

| File | Contents |
| --- | --- |
| `run.json` | Dataset version/checksums, generation and judge configuration, embedding profile, seed, selected count, repetitions, workers, package versions, Git commit/dirty state, timestamps, completion/cleanup flags, and setup usage. |
| `rows.jsonl` | Completed case/variant/repetition results, response/evidence, retrieval traces, metrics, errors, timing, and product/judge usage events. |
| `summary.json` | Aggregates by variant, split, and category, plus comparisons over complete case/repetition pairs. |
| `report.md` | Readable tables, denominators, exclusions, and limitations. |
| `aggregate_metrics.csv` | Quality, coverage, latency, and usage aggregates with measurement counts. |
| `human_review.csv` | Question, resolved question, reference, response, cited passages as JSON, automatic metrics, and blank reviewer/rating fields. Use the case ID to find expected intent and history in the dataset snapshot. |
| `snapshot/` | Exact dataset files and evaluated Python implementation, dependency manifest, and lockfile. |

Implementation checksums preserve the evaluated code even when the working tree is uncommitted. Dataset/source checksums identify the inputs. To reproduce an experiment, retain the whole directory, use its snapshots and locked dependencies, and match the model/deployment, embedding profile, seed, split, repetitions, and worker count. The snapshot does not preserve credentials, the provider's model weights/version behind a deployment, or remote runtime conditions; equal configuration does not guarantee equal scores.

Regenerate reports without further model use:

```sh
.venv/bin/python -m trellis_eval report ../.data/evaluations/test-v1
```

An existing `human_review.csv` is retained unchanged, including human ratings. To create a fresh worksheet, intentionally rename or remove the existing file before rebuilding reports. A new worksheet starts blank because running the validator or an automatic judge is not human review.

For independent review:

1. Check the reference passages, expected facts, relevant source IDs, allowed status, and conversational intent before looking at model scores. Verify attributed paraphrases against their public documentation; keep fictional policies clearly scoped to the exercise.
2. Rate a balanced development sample containing supported, incorrect, conflicting, withheld, and unverified responses. Use the worksheet's human-rating fields on a documented scale, record reviewer identity, and explain disagreements in `human_notes`. Hide automatic scores during the first pass to reduce anchoring.
3. Compare human decisions with judge output, including failed or excluded judgments. Review citation completeness and policy wording separately because precision and status matching do not cover them fully.
4. Correct ambiguous or incorrect labels in a new dataset version, record who reviewed what, and freeze the revision before another comparison. Do not change gold labels after seeing a result and present the new score as a like-for-like improvement.
5. Preserve test exposure and review provenance. Do not mark the dataset human-reviewed merely because a few outputs were checked; reference review and judge calibration are separate tasks.

The small English software-education fixture set does not cover all learning domains, real users, live discovery, source freshness, PDF/OCR ingestion, long documents, frontend interactions, or production traffic. Those require separate verification.

## Describing the work accurately

A résumé or project description can state the implemented capability without inventing gains:

> Built a local evaluation harness for a source-aware learning assistant, supporting controlled baseline comparisons on a versioned 96-case fixture set with model-judged answer quality, citation precision, retrieval recall, and token/latency reporting.

Only add a measured improvement after naming its run, baseline, dataset split, model/judge configuration, paired sample size, exclusions, and human-review status. Describe judge-score differences as judge-score differences, not as a proven increase in factual accuracy. This guide intentionally contains no claimed performance improvement.
