# Verification record

This file records the supported local Trellis scope. Deterministic tests use isolated PostgreSQL schemas and model doubles; real integration runs use the configured Azure services. Live runs create retained demonstration data or explicitly isolated temporary schemas.

## Acceptance mapping

| Scenario | Implementation and verification |
| --- | --- |
| S-001 Goal to path | Source-backed structured curriculum generation; invalid structures rejected before persistence. Real Azure generation checked. |
| S-002 Supplied outline | Outline mode preserves supplied topics and hierarchy; an independent fidelity assessment rejects omissions or additions. Real Azure generation and the frozen original snapshot checked. |
| S-003 Edit/extend/reorder | Stable node IDs retain history/progress. Tests cover reordering, cycles, cross-path parents, and guarded deletion. |
| S-004 Node workspace | Node-specific history/context and parent/position/progress. Browser view and API tests. |
| S-005 Progressive questions | Foundation/example/deeper/comparison/application UI actions; persisted provider answers and evidence. |
| S-006 Tangent thread | Independent thread records and history with a bounded originating context snapshot. |
| S-007 Return from tangent | Multi-node/multi-thread integration tests verify primary messages, progress, and location remain intact. |
| S-008 Evidence | Real source parsing/embeddings/pgvector search, supplied-source priority, fetched web sources and immutable response snapshots. |
| S-009 Evaluation | Citation membership, relevance/completeness/consistency/grounding, unsupported claims and evaluation failure gates. One correction is independently checked at unchanged thresholds; a controlled public-evidence fixture exercised rejection, live correction and acceptance. |
| S-010 Resume/restart | Database-backed workspace/node/thread location, history, learner progress and session periods. Final restart check recorded below. |
| S-011 Retention | One notebook per journey, ordered sections/notes, immutable origin/evidence, source-specific excerpt saves, and cross-journey write rejection. Actual browser editing, moving, reordering, isolation and legacy migration checked. |
| S-012 Export | Ordered snapshot includes selected items only. Tests reopen PDFs, check text/source references and preserve failed selections. Rendered examples inspected. |
| S-013 Failures | Invalid model output, unavailable provider, missing evidence, invalid citations, low grounding, failed evaluation, failed parsing and failed PDF generation. |

## Results

Verified locally on September 25, 2026, using PostgreSQL 17 with pgvector, the configured Azure chat deployment `gpt-5.6-luna`, and `text-embedding-3-large` embeddings with 3,072 dimensions.

| Check | Result |
| --- | --- |
| Backend `pytest -q` | **58 passed** across workspace/context, AI/evidence, notebook/export, and legacy migration cases. Includes new and legacy thread seeds originating from withheld answers. Tests use separate PostgreSQL schemas and do not reset the learner workspace. |
| Python Ruff | Passed for the backend, tests, and live verification script. |
| Alembic migrations and `alembic check` | Migrations applied through `9b72d630fa14`; no missing model/schema changes. Before applying notebook ownership, a disposable copy of the actual database preserved all 6 notes and 3 export snapshots; no records remained unassigned. Legacy mixed-section migration also has a real PostgreSQL regression. Local SQL backups were retained. |
| Frontend type check and production build | Passed with Next.js 16 and React 19. |
| Playwright regressions | **16 passed** against the final Docker UI: source-aware creation, independent threads and reading position, route-driven resume, curriculum provenance, source reindexing and journey attachment, formatted/withheld responses, note destination and failed-save preservation, editing during search, journey isolation, and export state. These intercept API responses. |
| Real Azure API workflow | Passed: URL ingestion, structured goal-based curriculum, evidence retrieval, answer/evaluation, exploratory thread, progress, notebook, saved selection, PDF download. |
| Real browser workflow | Passed against the running API: Azure question, previous-response restoration, thread close/reopen, persisted progress, notebook save/edit/move, selection reload, actual PDF download, source inspection, provider options, outline creation, and adding a curriculum node. No page errors; checked 1,024-pixel laptop layout for horizontal overflow. |
| Real curriculum verification after fixes | Public Python documentation was ingested into 15 chunks in an isolated schema. Azure generated 5 goal-based nodes with valid source references and a passing assessment, then preserved the supplied outline and hierarchy in a separate fidelity check. Original generation snapshots matched the persisted output. The temporary schema was removed. |
| Real correction verification after fixes | An intentionally incorrect fixture draft about `list.pop()` was rejected by the live Azure evaluator, corrected using the same freshly fetched public documentation, and accepted after a fresh live evaluation. Total observed duration: 9.84 seconds. The initial incorrect draft was injected to exercise the failure path; correction and both evaluations used Azure. |
| Real notebook verification after fixes | Created sections and notes; edited, reordered, moved and refreshed them; confirmed another journey excluded them. Saved study order survived refresh and a 43,998-byte PDF contained the selected notes in order with the journey label. Removing only a verification note left the previous PDF byte-identical. Actual saved HybridRAG feedback contained no UUID dump, and its note dialog excluded Python sections and preserved the correct journey/node origin. No AI requests or browser page errors. |
| Existing thread context after fixes | A read-only check inside the final Docker backend built context for all 3 stored threads. One legacy seed contained a rejected diagnostic dump; the context replaced it with the neutral marker while preserving its question. No saved records were changed and no AI requests were made. |
| Web-only evidence | Fetched readable pages discovered by web search and generated a cited, evaluated answer without uploaded sources. |
| PDF ingestion | Uploaded the public W3C dummy PDF; extracted and indexed its text, then successfully reindexed the same stored upload from inside the Docker backend. |
| Docker | Both application images built from locked dependencies. Database and API health checks passed; UI and its same-origin API proxy responded. Backend image smoke checks covered pgvector, HTTPS fetching, and PDF Unicode body/code fonts. A final real browser check loaded the persisted node and answer with no page errors. |
| Restart and mode portability | Initial verification moved the same database from development processes to Docker. After the fixes, restarted PostgreSQL and the Docker API with a non-null active node and thread: **11 API resource snapshots were unchanged**, including location, paths, node/thread conversations, notebooks, selections, exports, sessions, history and sources. **All 4 PDF downloads retained identical SHA-256 checksums.** |
| Browser resume after restart | Home displayed the stored topic and thread names; Continue opened the exact saved path/node/thread, and refresh retained all three IDs. No AI requests or page errors. The browser closed and the learner's original HybridRAG overview location was restored afterward. |
| PDF layout | Reopened exported PDFs to verify selected content, order, source numbering, and Unicode text; rendered and visually inspected examples for pagination and legibility. |

One live draft was withheld because it introduced a tuple-slicing detail unsupported by its retrieved excerpts. This confirms that the abstention path was exercised with real model output; it is not proof that all unsupported claims will be detected.

Observed API durations in the retained demonstration were 9.86 seconds for a node answer including evaluation, 8.68 seconds for a thread answer including evaluation, and 0.12 seconds for a one-page PDF export. A separate web-only answer took approximately 17.7 seconds. These are individual observations, not performance guarantees.

The working database retains the learner's journeys plus demonstration and verification material. The [workspace screenshot](assets/trellis-learning-workspace.png) captures the implemented design. Machine-readable local run records and rendered PDFs are in the Git-ignored `.data/verification/` directory. The latest records are `fixes-live-curriculum.json`, `fixes-live-correction.json`, `fixes-live-notebook.json`, `fixes-notebook-migration.json`, `fixes-active-thread-restart.json`, and `fixes-browser-resume.json`; the actual corrected screens are in `hybrid-withheld-fixed.png`, `hybrid-scoped-note-dialog.png`, and `notebook-scoped.png`. Earlier full workflow records remain alongside them. These files can contain learning content and are deliberately kept local.

Run the deterministic checks with `make test`, `make build`, and `cd trellis-ui && pnpm test:e2e`. Install Playwright Chromium once with `pnpm exec playwright install chromium`, or use an installed Chrome via `PLAYWRIGHT_CHANNEL=chrome`. Set `TRELLIS_EXTERNAL_UI=1` to use the already-running Docker UI. The real provider workflow is reproducible with `backend/.venv/bin/python scripts/verify_live.py`; it makes external provider calls and retains its demonstration data.

## Practical limits

- Only the configured Azure provider has been tested live. OpenAI, OpenRouter and Ollama have SDK request-contract tests; their live operation requires credentials or a running local model with structured-output support.
- Automatic approval review blocked replaying the exact stored HybridRAG conversation because it would send local learning material and context to Azure. The correction mechanism was verified with public documentation instead; the existing saved HybridRAG response and notebook were checked locally without new AI requests.
- Automated grounding evaluation uses a model and can make mistakes. Strict withholding can reject a mostly useful draft if one detail lacks support. Source citations are traceability, not proof of truth.
- Web search and site access depend on external availability. Trellis abstains when it cannot obtain sufficient evidence.
- No OCR, authenticated/private-site crawling, autonomous mastery scoring, adaptive curriculum redesign, multi-user access, or hosting is part of this build.
- Source jobs resume after a process restart. Interrupted PDF exports are marked failed and can be requested again from retained selections. This is a single-process local workflow.
- Observed timings describe these runs only; they are not general latency benchmarks or evidence of improved learning outcomes.
