# Trellis implementation contract

Confirmed scope: all Phase 1 and Phase 2 requirements, single local workspace, no authentication or hosting. Preserve the current ivory/sage/indigo UI and add matching flows. Azure, OpenAI, OpenRouter, and Ollama are selectable chat providers. Supplied files/URLs take priority; web supplies evidence when no material is supplied. Unsupported answers abstain. Model evaluation is a quality signal, never a factual guarantee.

## Shared conventions

- Backend: `backend/trellis`, FastAPI, synchronous SQLModel sessions, PostgreSQL/pgvector, Alembic. All routes prefixed `/api`. IDs are UUID strings; timestamps are UTC ISO strings.
- Frontend: existing `trellis-ui` on port 3100. Fetch same-origin `/api`; Next rewrites to FastAPI on host port 8100 (container port 8000). JSON errors have `detail`. No credentials returned to browser.
- Do not put fixtures in normal product flows. Tests may inject deterministic services.
- Domain models live in `trellis.models`; database dependency is `trellis.db.get_session`, yielding `sqlmodel.Session`. `trellis.db.engine` is the shared engine. Each service takes an explicit session. Commit only complete changes.

## Core API (root owns)

- `GET /health` -> `{status, database}`.
- `GET /workspace` -> `{paths: PathSummary[], location: {path_id,node_id,thread_id}, location_detail: {path_title,node_title,thread_title}, stats: {paths,nodes,completed,notebook_items}}`.
- `GET /paths` -> PathSummary[]. `POST /paths` with `{input, mode: "goal"|"outline", source_ids?: string[]}` -> PathDetail. AI service `generate_curriculum(session, input, mode, source_ids)` returns `{title,description,nodes:[{title,description,parent_index:null|number}], evidence?:[]}`. Parent indices refer to preceding nodes.
- `GET /paths/{id}` -> PathDetail `{id,title,description,input,created_at,progress,nodes: Node[]}`. `PATCH` accepts title/description.
- `POST /paths/{id}/nodes` with `{title,description,parent_id?}` -> Node.
- `POST /paths/{id}/reorder` with `{node_ids}` -> PathDetail. Exact complete permutation required.
- `PATCH /nodes/{id}` with title/description/parent_id. `PATCH /nodes/{id}/progress` with `{status:"not_started"|"in_progress"|"completed"}` -> Node.
- `GET /nodes/{id}` -> `{node,path,nodes,interactions:Interaction[],threads:Thread[]}`.
- `POST /nodes/{id}/interactions` with `{prompt,action?:"foundation"|"question"|"example"|"deeper"|"comparison"|"application"}` -> Interaction. Root assembles scoped context then calls `ai.answer(session, context, prompt)` -> `{content,status,evidence,evaluation,provider,model}`. context has path_id/path_title/node_id/node_title/node_description/ancestors/progress/history and optional thread_id/thread_title/seed_context. History never includes another node/thread. Evidence is immutable JSON snapshots with id/source_id/title/url/excerpt/location/kind.
- `POST /nodes/{id}/threads` with `{title,interaction_id?}` -> Thread. `GET /threads/{id}` -> `{thread,node,path,interactions}`; `PATCH` with `{status:"open"|"closed",title?}` -> Thread. `POST /threads/{id}/interactions` body as above -> Interaction.
- `PUT /location` with `{path_id,node_id?,thread_id?}` -> location. Thread location must agree with its origin; primary node/progress/messages must remain intact.
- `GET /history` -> Activity[] `{id,path_id,node_id,thread_id,kind,label,created_at}`.

PathSummary has id/title/description/progress/node_count/completed_count/updated_at. Node has id/path_id/parent_id/title/description/position/status. Thread has id/path_id/node_id/title/status/seed_context/created_at. Interaction has id/path_id/node_id/thread_id/prompt/content/action/status/evidence/evaluation/provider/model/created_at. `thread_id=null` means primary node only.

## AI/evidence API (AI agent owns `ai.py`, `evidence.py`, `provider_routes.py`)

- `GET /settings` -> `{provider,model,providers:[{id,label,configured,model,base_url}],embedding:{provider,model,dimensions},evidence_policy}`. `PUT /settings` accepts `{provider,model}`. Credentials and endpoint overrides come from `.env`; selected provider/model persist in AppSettings id=1. Initial defaults read existing Azure settings exactly.
- `POST /settings/test` with optional `{provider,model}` -> `{ok,message}`. No secret output.
- `GET /sources?path_id=...` -> Source[] (optional path filter). Source has id/path_id/title/kind/url/status/error/chunk_count/created_at; never content blobs or vectors in this list.
- `POST /sources/upload` multipart `{file,path_id?}` -> Source. `POST /sources/url` JSON `{url,path_id?}` -> Source. `POST /sources/text` JSON `{title,content,path_id?}` -> Source (pasted material). Persist processing status and expose failures. `GET /sources/{id}` -> source metadata plus readable excerpts. `POST /sources/{id}/retry` and `DELETE /sources/{id}`.
- Supplied source ids can be attached during path creation. Sources belonging to another path must not leak into retrieval. A node uses sources attached to its path. Unattached sources are offered for selection in journey creation.
- Use packages for parsing/chunking/embeddings/search; preserve URL and page/section metadata. pgvector `Vector()` stores embeddings with profile string so profile/dimension mismatches cannot be compared. No ANN index is required at local corpus scale.
- Strict answer: retrieve first, prioritize supplied evidence, use actual fetched web content, request structured cited output, validate citation membership and model-assisted relevance/completeness/faithfulness. With missing evidence or unsupported content, persist an abstention; never present guessed facts or fake scores.

## Notebook/export API

- One notebook belongs to each learning journey. Its sections retain the API/model name `NotebookPage`; they are not physical PDF sheets.
- `GET /notebook/pages?path_id=...` -> that journey's sections with nested items. `POST /notebook/pages` `{path_id,title}`; `PATCH /notebook/pages/{id}` `{title,position?}`; `DELETE` section only if empty. Ordering is local to the journey.
- `POST /notebook/items` `{page_id,interaction_id?,content?,title?,node_id?,thread_id?,evidence_id?}`: save response, evidence excerpt, or personal note with immutable origin/evidence snapshot. `PATCH /notebook/items/{id}` supports page_id/title/content/position; `DELETE` item. Reorder `POST /notebook/pages/{id}/reorder` `{item_ids}`.
- `GET /study-sessions?path_id=...` -> StudySet[] `{id,path_id,title,item_ids,created_at}`; `POST` `{path_id,title,item_ids}`; `PATCH /study-sessions/{id}` `{title?,item_ids?}`. Selection survives refresh.
- `POST /exports` `{path_id,title,item_ids,study_session_id?}` -> ExportRecord `{id,path_id,title,status,error,created_at,download_url}`. Snapshot only explicitly selected items in requested order. `GET /exports?path_id=...` lists that journey's exports; `GET /exports/{id}` metadata; `GET /exports/{id}/download` PDF.
- Notes inherit their section's journey. The server rejects saving foreign-journey responses/excerpts, moving notes across journeys, and mixing journeys in a selection or export. Rejected teaching answers cannot be retained as accepted learning content. Legacy unfiltered GETs remain available, while the UI always scopes its notebook requests.
- Generate PDF using suitable library, render/reopen in test. Errors preserve notes and selection. Files in configured DATA_DIR, never user-supplied paths.

## Delivery checkpoints

1. Local services, schema, health and persistence.
2. Curriculum creation/editing and node/thread isolation.
3. Provider selection and source-prioritized grounded generation.
4. Notebook organization, persisted selection and readable PDF.
5. Browser scenarios S-001–S-013, real Azure/web evidence, restart persistence, documentation and limitations.
