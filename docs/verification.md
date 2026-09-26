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
| Backend `pytest -q` | **61 passed** across workspace/context, AI/evidence, notebook/export, and legacy migration cases. Includes new and legacy thread seeds originating from withheld answers and independent PostgreSQL sessions changing progress while an answer is pending. Tests use separate PostgreSQL schemas and do not reset the learner workspace. |
| Python Ruff | Passed for the backend, tests, and live verification script. |
| Alembic migrations and `alembic check` | Migrations applied through `9b72d630fa14`; no missing model/schema changes. Before applying notebook ownership, a disposable copy of the actual database preserved all 6 notes and 3 export snapshots; no records remained unassigned. Legacy mixed-section migration also has a real PostgreSQL regression. Local SQL backups were retained. |
| Frontend type check and production build | Passed with Next.js 16 and React 19. |
| Playwright regressions | **22 passed** against the final Docker UI: source-aware creation, independent threads and reading position, route-driven resume, curriculum provenance, source reindexing and journey attachment, formatted/withheld responses, note destination and failed-save preservation, editing during search, journey isolation, export state, pending composer drafts, and new-thread scope wording. These intercept API responses. The latest run is in `four-fixes-browser/`. |
| Real Azure API workflow | Passed: URL ingestion, structured goal-based curriculum, evidence retrieval, answer/evaluation, exploratory thread, progress, notebook, saved selection, PDF download. |
| Real browser workflow | Passed against the running API: Azure question, previous-response restoration, thread close/reopen, persisted progress, notebook save/edit/move, selection reload, actual PDF download, source inspection, provider options, outline creation, and adding a curriculum node. No page errors; checked 1,024-pixel laptop layout for horizontal overflow. |
| Real curriculum verification after fixes | Public Python documentation was ingested into 15 chunks in an isolated schema. Azure generated 5 goal-based nodes with valid source references and a passing assessment, then preserved the supplied outline and hierarchy in a separate fidelity check. Original generation snapshots matched the persisted output. The temporary schema was removed. |
| Real correction verification after fixes | An intentionally incorrect fixture draft about `list.pop()` was rejected by the live Azure evaluator, corrected using the same freshly fetched public documentation, and accepted after a fresh live evaluation. Total observed duration: 9.84 seconds. The initial incorrect draft was injected to exercise the failure path; correction and both evaluations used Azure. |
| Real notebook verification after fixes | Created sections and notes; edited, reordered, moved and refreshed them; confirmed another journey excluded them. Saved study order survived refresh and a 43,998-byte PDF contained the selected notes in order with the journey label. Removing only a verification note left the previous PDF byte-identical. Actual saved HybridRAG feedback contained no UUID dump, and its note dialog excluded Python sections and preserved the correct journey/node origin. No AI requests or browser page errors. |
| Existing thread context after fixes | A read-only check inside the final Docker backend built context for all 3 stored threads. One legacy seed contained a rejected diagnostic dump; the context replaced it with the neutral marker while preserving its question. No saved records were changed and no AI requests were made. |
| Concurrent progress and pending drafts | The completion regression failed before the fix and now preserves completed/in-progress changes committed by another database session while AI generation waits. Six focused browser checks cover successful composer clearing, newer drafts after success/failure, failed submission retention, quick-action draft retention, and accurate new-thread scope. |
| Custom Ollama endpoint in Docker | Compose resolution checked the default, a custom laptop port, and a named service URL. An actual ephemeral Docker backend and its SDK sent the Settings connection check to a temporary local HTTP fixture at the configured custom port. This verifies endpoint routing and structured response handling, not live Ollama model behavior. Records: `fixes-ollama-compose.json` and `fixes-ollama-container.json`. |
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

## Source selection update

The creation form now starts with no selected material, offers new material or an explicit library picker, and excludes automatically discovered web pages from that picker. The existing rule remains: library material must not already belong to another journey. Previews show source origins and indexed passages, with retry/reindex controls. Removing a selection keeps its source; permanent deletion remains in Sources behind confirmation.

Verified the production Docker frontend with **10 relevant browser regressions**: source selection, cancellation, preview, deselection without deletion, indexing readiness, permanent-delete confirmation, journey creation, and existing source retry/attachment flows. Type checking and the production build passed. A separate real-browser check at 1,024 × 768 used the local API and verified all 14 source records remained unchanged, with zero writes and no browser errors. No AI calls were needed. Results and screenshots are in `.data/verification/source-flow-browser/`, `source-preview-browser/`, `source-flow-live-final.json`, `source-flow-empty-final.png`, and `source-flow-preview-final.png`.

## Resizable study panel

The AI / Notebook / Evidence panel uses `react-resizable-panels` for pointer and keyboard resizing on screens at least 1,280 pixels wide. It starts at 360 pixels, stays between 280 and 520 pixels, and reserves at least 55% of the remaining workspace for the lesson. The library remembers the selected layout; narrower screens keep the stacked layout. Long source titles, locations, code excerpts and notebook titles wrap within their panel.

The production Docker frontend passed **7 focused browser regressions**: four layout checks covering dragging, keyboard limits, persistence, tab switching, citation focus, long content and responsive changes, plus three existing learning/thread checks. These use intercepted API responses. Type checking and the production build passed. A separate browser check loaded the learner's actual cache-aside response and expanded the `ConnectionMultiplexer` passage from the reported screenshot: neither the card nor its excerpt overflowed at either width limit, with no page errors or data writes. Screenshots and records are in `.data/verification/sidebar-browser/`, `sidebar-live-final.json`, `sidebar-code-live-final.json`, `sidebar-code-wide-final.png` and `sidebar-code-narrow-final.png`. No AI calls were made.

## Growing journey sources

Later questions can expand a journey's evidence collection. Retrieval reuses supplied material and saved web pages from that journey, with supplied passages first. A missing part of the question identified by either the draft or its independent review can trigger one targeted web search. Up to three new relevant, readable pages are saved; duplicate URLs, failed downloads and irrelevant candidates do not create new library records. Search snippets are never answer evidence. New passages still have to pass citation and grounding checks. A previously verified partial answer is preserved if an attempted fuller answer fails those checks.

The UI explains conditional web research while waiting, distinguishes freshly searched from saved web evidence, refreshes the journey's Sources list, and keeps source errors separate from routine supplementation. Existing single-response reading, AI history, notebook ownership and sidebar resizing remain intact.

The full backend suite passed **91 tests** against isolated PostgreSQL schemas. New coverage includes draft/review coverage gaps, supported partial answers, failed searches and embeddings, the one-search limit, source persistence/deduplication, and a full API sequence from supplied-only answers through web discovery and later reuse. That API regression uses real routes, ingestion, pgvector and persistence while mocking the external search, download and AI boundaries; thread and journey isolation are also checked. Python Ruff passed.

Both Docker application images built successfully, and the running backend and frontend were updated. **29 browser regressions passed** against the production UI, including five web-evidence cases plus existing response, source selection, notebook, thread and resizing flows. These browser regressions intercept API responses; their output is retained locally in `.data/verification/web-fallback-browser/`.

A separate live run used the configured Azure `gpt-5.6-luna` model and embeddings, DDGS, actual page downloads, and an isolated PostgreSQL schema. Starting with one supplied Microsoft cache-aside page, a question about write-behind persistence triggered web research, saved three ready sources with the same journey, and returned a checked answer citing supplied and discovered passages in **33.877 seconds**. Repeating the question returned a checked answer in **17.050 seconds**, with no new search or duplicate sources. Chrome loaded the production UI and forwarded its API requests to the isolated live backend; citation navigation, the web research notice, and current-journey source origins passed with zero browser errors. Both temporary APIs and schemas were cleaned up. Results and screenshots are in `.data/verification/web-fallback-live.json`, `web-fallback-live-answer.png` and `web-fallback-live-sources.png`.

An earlier live question explicitly required official write-behind documentation. Search returned readable material but did not meet that restriction, so Trellis correctly withheld an answer. This outcome is retained separately in `web-fallback-live-official-only.json`; it illustrates that automatic research does not bypass the learner's source restrictions or guarantee sufficient evidence. The observed timings describe individual runs, not performance guarantees.

## Journey collections and navigation

Home now shows a Continue action and up to four recently studied journeys. My Journeys and Notebooks are searchable collections with progress filters, sorting and 12-item pagination. An opened journey has a named breadcrumb and Curriculum / Notebook / Sources / Study tabs. Source Library is global; journey sources name their journey, and add actions state whether material will enter the library or attach to that journey. Journey dropdowns and the implicit active-journey sidebar were removed.

Resume metadata comes from existing learning sessions, independently for each journey. Opening a curriculum, notebook, source list or study selection does not move the last studied node or thread; creating a journey also leaves it intact. Notebook counts and last-update times include note and section changes. No schema migration was needed for these changes.

The backend suite passed **97 tests** against isolated PostgreSQL schemas, including per-journey node/thread resume, creation and browsing preservation, notebook update metadata, and a constant query count with 21 journeys. Ruff passed for changed backend files. **62 browser regressions passed** against the rebuilt Docker frontend, including collections, explicit journey scope, legacy routes, source destinations, drafts, exports, evidence and panel resizing. These browser tests intercept API responses. Type checking and the production build also passed.

A separate walkthrough used the actual local database and API. All global collections and local journey tabs made zero API writes and left the workspace response unchanged. A real notebook draft survived another journey, local tabs and reload, then was discarded without saving. Continue requested the exact saved node/thread; that one location write was intercepted to keep learner data unchanged. Desktop and 390-pixel layouts were inspected, including a fix for source controls squeezing their titles on narrow screens. There were no browser errors or failed API reads. The database was backed up before deployment, and counts/content hashes for 13 learning tables matched before and after the update. Local reports and screenshots are in `.data/journey-navigation/`.

## Active-thread context and general-knowledge fallback — September 26, 2026

The approved behavior now resolves each question once against the active conversation. Retrieval uses the resolved public search terms; drafting and independent review receive the same standalone question and scoped context. Parent-node information remains background in an exploratory thread.

When sources and the bounded web attempt cannot provide sufficient evidence, ordinary learning questions can receive a separate general-knowledge response. It is saved as `unverified`, has no evidence or grounding score, and carries its warning through notebook editing, moving, study review, and PDF export. Sources only and source-specific requests still require evidence. Invalid citations, rejected drafts, and failed evaluations do not unlock general-knowledge fallback. Retrying uses the current Sources only choice. A failed model call during fallback has a distinct generation-error message.

| Check | Result |
| --- | --- |
| Backend regression suite | **116 passed** with isolated PostgreSQL schemas. After the final error-message adjustment and one additional regression, **66 focused AI/context/fallback tests passed**. |
| Python Ruff and frontend typecheck | Passed. |
| Production build and local startup | Both Docker images built; backend and frontend healthy. `/api/health` through port 3100 returned database `ok`. |
| Browser regressions | **67 passed** against the rebuilt Docker UI, including fallback labels, source-only questions/actions/retries, provider failures, notebook/study provenance, previous-answer selection, web evidence, sidebar resizing, and journey navigation. These tests use API doubles. |
| Live QPS follow-up | Actual Azure resolution, public web search/indexing, drafting, and evaluation passed. “Explain more” became “Can you explain more about QPS (queries per second) as a measure of query throughput?” All stages used QPS context, the answer cited six passages, and parent progress remained unchanged. |
| Live general-knowledge behavior | With retrieval explicitly injected empty to simulate unavailable sources/web, the real Azure generator returned an unverified explanation with no citations or grounding scores. Sources only withheld it without invoking general generation. Saving and exporting retained the warning; the PDF was reopened and visually inspected. |
| Browser with real API and database | **16 integration checks passed**: displayed the recorded live unverified answer, created a notebook section, saved/edited/reloaded the note, persisted a study selection, and exported/downloaded the actual PDF. The immutable origin and visible warning survived throughout. The built UI used a temporary uvicorn server and PostgreSQL schema; the download link's host was explicitly mapped to that isolated server because Chrome downloads bypassed request forwarding. No additional AI calls or learner-data writes; server/schema/temp files cleaned up. |

The live model report contains **14 passing checks** and clearly identifies the injected evidence outage. It used a synthetic public discussion in a disposable schema, without reading or modifying learner history. Artifacts: `.data/verification/context-general-knowledge-live.json`, `.data/verification/context-general-knowledge-live.pdf`, `.data/verification/context-general-knowledge-browser-integration.json`, and the corresponding local verification scripts. These checks demonstrate the exercised flows; automated evaluation cannot guarantee correctness for every future answer.

## Learning-goal scope preservation — September 26, 2026

A saved GPU journey exposed a curriculum failure: its full four-phase request was retained, but the generated path contained six flat topics and its completeness assessment of 24% was accepted. Goal creation now plans from the entire request before retrieving evidence for each root topic. Recognized heading/list structure must survive planning and generation; useful inferred children must also survive the final generation. All parents and children count toward the explicit 40-node limit.

Acceptance now requires completeness of at least 0.9, no reported missing topics, preserved hierarchy, valid per-topic citations, and the existing grounding gates. A negative independent goal review allows one revision with up to three focused evidence queries; the revised result must pass every gate. Outline import keeps a single generation and fidelity review without web retrieval or inferred additions. No failed final check creates a path or its nodes.

The original request and input mode are visible in the curriculum. Older saved low-completeness assessments show a coverage warning without modifying their original result or the learner's content. A saved model score is an assessment, not a measured proportion of actual topic coverage.

Regression cases for this change are in `backend/tests/test_curriculum_structure.py`, `backend/tests/test_curriculum_goals.py`, and `trellis-ui/tests/curriculum-input.spec.ts`. They target the four-phase/twelve-topic request, dropped or reparented topics, inferred children, evidence for later phases, rejection of low completeness and reported omissions, size limits, retained original input, and historical assessment display. The earlier live results above predate this curriculum change; they do not establish its live behavior.

Verification for this change:

- **198 backend tests passed**, including bounded correction, unchanged outline behavior, and rejection before path/node persistence. Ruff passed.
- **78 browser tests passed** against the rebuilt production UI on port 3100 with mocked API fixtures. TypeScript, formatting, and the production build passed.
- A separate read-only browser check used the real saved GPU journey and API. Its 24% warning, exact 1,898-character original request, Learning goal mode, and historically labelled passed result were verified without writes.
- A real Azure run using the full GPU request produced a **28-node hierarchy**: four phases, twelve requested topics, and inferred children. Direct checks confirmed all explicit titles, order, parent relationships, and citation-ID membership. Retrieval covered all four phases; the first semantic review rejected insufficient support, and the single correction used three targeted searches. The final semantic review timed out. Other live attempts also encountered provider timeouts, so **successful end-to-end live creation remains unverified**. No accepted journey was saved from these attempts, and all disposable schemas were removed.
- The local Docker app was rebuilt and restarted. A PostgreSQL backup was verified, and hashes of 13 learner-data tables matched before and after deployment.

Local artifacts are under `.data/curriculum-fix/`: `production-ui-tests`, `legacy-production-browser.json` and its screenshots, `live-goal-final-review-timeout.json`, `live-structural-check.json`, and the other live-attempt reports. These distinguish real provider work from mocked regression tests and from final acceptance that could not be completed.

## Practical limits

- Only the configured Azure provider has been tested live. OpenAI, OpenRouter and Ollama have SDK request-contract tests; their live operation requires credentials or a running local model with structured-output support.
- Automatic approval review blocked replaying the exact stored HybridRAG conversation because it would send local learning material and context to Azure. The correction mechanism was verified with public documentation instead; the existing saved HybridRAG response and notebook were checked locally without new AI requests.
- Automated grounding evaluation uses a model and can make mistakes. Strict withholding can reject a mostly useful draft if one detail lacks support. Source citations are traceability, not proof of truth.
- Web search and site access depend on external availability. When evidence is unavailable, ordinary learning questions may receive labelled, unverified general model knowledge. Sources only and source-specific questions still require evidence; rejected drafts and failed checks remain withheld.
- No OCR, authenticated/private-site crawling, autonomous mastery scoring, adaptive curriculum redesign, multi-user access, or hosting is part of this build.
- Source jobs resume after a process restart. Interrupted PDF exports are marked failed and can be requested again from retained selections. This is a single-process local workflow.
- Observed timings describe these runs only; they are not general latency benchmarks or evidence of improved learning outcomes.
