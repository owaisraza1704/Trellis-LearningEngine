# Trellis completion audit

This audit uses the approved synopsis, `tmp/requirements.md`, `tmp/implementation_plan.md`, and the subsequent local-only and notebook decisions. The latest notebook rule is **one notebook per learning journey, reused across visits**. Sections organize notes inside that notebook; PDF sheets are generated during export.

## Gaps identified and addressed

| Gap | Required behavior and fix |
| --- | --- |
| Evaluator text appeared as the teaching answer | Keep evaluation diagnostics separate from answer content; show concise abstentions for both new and previously saved responses. |
| One unsupported claim discarded an otherwise useful draft | Permit one source-bounded correction and independently re-evaluate it at unchanged thresholds. A still-unsupported correction is withheld. |
| Raw UUIDs, scores, and Markdown appeared in the learning UI | Render Markdown with the existing renderer; use readable assessment labels, percentages, bounded prose, and numbered source references. |
| Rejected responses could be saved as teaching material | Reject that save at the API and hide the response-save action; source excerpts and personal notes remain available. |
| A withheld response could leak diagnostic text into a new exploratory thread | Retain its question but replace rejected content with a neutral marker in the originating context; apply the same rule when using existing legacy thread seeds. |
| Notebook pages were confused with physical sheets | Name them sections and explain that they group notes; PDF layout determines physical page breaks. |
| Saves defaulted to an unrelated first section | Require an explicit section or a deliberate new section, within the current journey's notebook. |
| Notebooks mixed unrelated learning journeys | Derive one notebook from each journey; scope sections, notes, review selections, and exports to that journey and enforce boundaries on the server. |
| Failed note saves could lose the new destination or draft | Retain the entered text and any successfully created section so retry does not create duplicates. |
| Searching while editing could redirect a draft to another note | Keep editor state tied to the note being edited; guard selection changes. |
| A pending PDF could later appear for a changed selection | Tie the prepared result to its requested selection; retain older exports as historical downloads. |
| Back/Forward and direct URLs did not update resume | Persist displayed study scope from route changes and serialize location writes. |
| Curriculum visits cleared the last studied topic | Preserve node/thread location for path-only navigation and restore prior journey sessions when switching. |
| Curriculum/Home did not identify the actual study location | Highlight the persisted node and display the last topic/thread names. |
| Ready sources had no reindex action | Expose reindexing and outdated embedding-profile state in Sources. |
| Preferred-source failures were hidden in answered responses | Display named source warnings beside the answer, including web supplementation. |
| Following “Review sources” could create an unattached source | Default Sources to the current journey so new material is available to the requesting node. |
| Notebook saves left activity timestamps stale | Use the same activity update path as learning interactions. |
| Curriculum generation lacked stored evidence/evaluation provenance | Validate per-topic citations and source support, or supplied-outline fidelity; freeze the original output, evidence, model, and assessment. Label older unrecorded generations honestly. |
| An answer finishing could overwrite a concurrent completion change | Advance progress with a conditional database update only when the stored node is still not started; preserve the learner's completed/in-progress state. |
| A response arriving could erase an unsent follow-up question | Clear only the unchanged text of a successful composer submission; preserve newer drafts, failed submissions and text prepared while using quick actions. |
| Docker ignored a custom Ollama endpoint from `.env` | Honor `OLLAMA_BASE_URL` when supplied and otherwise use the standard Docker-to-laptop address; document container-reachable custom URLs. |
| Starting another thread promised context it did not include | When creating a thread from within another thread, name the primary topic as its starting context. Selected primary-node responses remain included when starting there. |
| New journeys mixed old uploads and automatically discovered pages in one list | Start with an empty selection and offer separate add-material and library actions; the library contains eligible user-added material only. |
| Source origins and removal behavior were unclear | Label uploaded files, added URLs, pasted text and discovered web pages; preview material before choosing it and distinguish deselection from confirmed permanent deletion in Sources. |

## Functional requirement coverage

| Requirement | Implementation and verification focus |
| --- | --- |
| FR-001 Workspace | Single local workspace, persisted paths and resume state; empty-workspace and persistence tests. |
| FR-002 Learning input | Goal, topic, or outline; original input retained; API validation and browser creation. |
| FR-003 Curriculum | Structured hierarchy with stable IDs; malformed output rejected before persistence; real Azure generation. |
| FR-004 Navigation | Graph/list/node navigation and correct active-node highlighting; browser route tests. |
| FR-005 Path changes | Edit, add, reorder, and guarded removal without losing retained content; database and browser checks. |
| FR-006 Relationships | Parent hierarchy and sequence displayed; cross-path parents and cycles rejected. |
| FR-010 Node environment | Node-specific content, position, progress and history; multi-node isolation tests. |
| FR-011 Foundation | Foundation request produces a stored, source-bounded answer or explicit abstention. |
| FR-012 Progressive content | Examples, depth, comparison, application, and prior-response navigation. |
| FR-013 Scoped context | Global/path information, ancestors, and the last 12 interactions from exactly one scope; rejected diagnostic dumps excluded. |
| FR-014 Provider independence | Azure/OpenAI/OpenRouter/Ollama through the official compatible SDK; selected-model request tests and visible failures. |
| FR-015 History | Stored request, answer, scope, timestamp, evidence, provider and model. |
| FR-020 Thread creation | Source node/path and bounded seed context retained. |
| FR-021 Thread interaction | Independent conversations and switching; multi-thread tests. |
| FR-022 Thread preservation | Close/reopen and return without changing primary messages/progress/reading position. |
| FR-030 Retrieval | Supplied evidence first, fetched web material when needed, explicit missing-evidence state. |
| FR-031 Evidence representation | Identifiable sources, exact excerpts/locations, retained response and notebook snapshots. |
| FR-032 Vector retrieval | PostgreSQL/pgvector ranking with scope and embedding-profile filters; fixture and live retrieval checks. |
| FR-033 Grounded generation | Every teaching block references supplied evidence IDs; membership checks and evaluation before display. |
| FR-034 Evaluation | Stored relevance, completeness, consistency, grounding, explanation, method and timestamp. |
| FR-035 Failure states | Missing evidence, source failure, invalid citations, unavailable evaluation and rejected correction remain explicit. |
| FR-040 Global state | Journey, progress, last study location, names and activity timestamps persisted. |
| FR-041 Local state | Node/thread history stored independently; reading selection retained per scope in the local browser. |
| FR-042 Progress | Explicit not-started/in-progress/completed; journey percentage is completed nodes divided by all nodes. |
| FR-043 Resume | Route-driven saved location, per-journey restoration and restart verification. |
| FR-044 Activity | Chronological learning/progress/note activity linked to its source scope. |
| FR-050 Retention | Accepted responses, exact source excerpts and personal notes saved with origin; cross-journey saves rejected. |
| FR-051 Organization | One notebook per journey, ordered sections and notes, edit/move/reorder/remove within its boundary. |
| FR-052 Study selection | Persisted ordered selections restricted to one journey; removing notes updates live selections. |
| FR-053 PDF | Immutable selected-only snapshot, context/sources/timestamp, automatic pagination, status/download and failure preservation. |
| FR-060 Configuration | Server-only environment credentials and persisted chat selection; separate embedding configuration. |
| FR-061 Background work | Durable source statuses, background indexing and restart recovery; short PDF rendering stays synchronous. |
| FR-062 Errors | Visible actionable errors for failed requests; previously saved state preserved. |

## Non-functional and plan coverage

NFR-001–003 are checked through scope, persistence and provenance tests. NFR-004–008 are covered by provider separation, explicit failures, local server-only configuration, conventional module boundaries and deterministic test doubles. NFR-009 uses locked dependencies, Alembic migrations and Docker. NFR-010 covers the corrected browser workflows; NFR-011 uses visible pending states and background source ingestion, without asserting universal latency targets.

P1.1–P1.7 cover the local foundation, schema, curriculum, learning, threads, resume and core verification. P2.1–P2.5 cover evidence, evaluation, notebook and export. P2.6 explicitly makes Redis/Celery conditional; durable local source jobs and synchronous short PDFs satisfy this workload without separate worker infrastructure. P2.7 is recorded in [verification.md](verification.md), including screenshots, real integrations, migrations, restart checks, observed timings and limits.

Authentication, hosting, multi-user administration, autonomous mastery/adaptation, formal pedagogical modes, comprehensive knowledge graphs, OCR, and educational-efficacy claims remain outside the agreed scope. “No hallucinations” is implemented as source-bound generation, validation, correction and abstention; automated evaluation is not a factual guarantee.

## Verification boundary

The final command results and live observations are maintained in [verification.md](verification.md). OpenAI and OpenRouter require credentials not present in this workspace; Ollama requires a running local model service. Their request contracts are tested, while live AI validation uses the configured Azure services. Replaying the user's stored HybridRAG conversation was blocked by automatic approval review; the correction mechanism is instead exercised with public documentation and an intentionally incorrect fixture draft, plus local rendering of the existing saved response.
