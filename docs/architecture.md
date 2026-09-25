# How Trellis works locally

Trellis is one learner workspace served by a Next.js UI, a FastAPI backend, and PostgreSQL with pgvector. There is no account or authentication layer. The UI keeps its original ivory, sage, and indigo design; new source, provider, notebook, and study-selection flows use the same components.

The browser sends same-origin `/api` requests. Next.js forwards them to FastAPI. React Query manages loading, errors, and refreshing server data; PostgreSQL remains the source of truth. The URL identifies the visible screen, path, node, and optional exploratory thread. The persisted workspace location powers the resume action.

## Follow one learning interaction

1. The node screen posts a question to `/api/nodes/{id}/interactions`, or to `/api/threads/{id}/interactions` when exploring a thread.
2. `backend/trellis/core.py` loads the node and constructs context from its path, position, ancestors, progress, and up to 12 prior interactions in that exact scope. A thread receives its saved starting context and its own history. Other nodes and other threads are excluded.
3. `backend/trellis/evidence.py` embeds the search query and ranks compatible pgvector chunks. Supplied documents and URLs are searched first. When those excerpts cannot answer the question, fetched public web pages can supplement them. Without supplied material, web content supplies the evidence. Search snippets only discover URLs; the application fetches and indexes the actual page text.
4. `backend/trellis/ai.py` requests structured answer blocks from the chosen provider. Each block must cite existing evidence IDs. Missing evidence or invalid references produce an abstention. An additional model call assesses relevance, completeness, consistency, and grounding. A failed grounding check permits one correction using the same evidence and review feedback, then independently checks the correction at unchanged thresholds. An evaluation outage or a still-unsupported correction withholds the proposed answer. Review diagnostics stay in evaluation metadata; the learner sees a concise message and retry action. Legacy abstention dumps are also replaced in the UI and excluded from future teaching history.
5. The backend assigns display citation numbers and saves the response, immutable evidence excerpts, evaluation, provider, model, scope, and activity record. The UI refreshes the active conversation and displays its sources and assessment.

The evaluator is an automated quality signal, not a proof of factual correctness. It can share mistakes with the generating model. Trellis enforces citation membership and withholds detected unsupported answers; it cannot guarantee that every accepted factual claim is true. The source excerpts remain available for inspection.

## Curriculum and context boundaries

Goal-based curriculum creation retrieves evidence before asking for an ordered hierarchy. Each topic must cite valid excerpt IDs, and a separate curriculum evaluation checks support for its topics and descriptions. Outline import uses the supplied outline as its authority and checks topic, ordering, and hierarchy fidelity without web retrieval. Pydantic validates the returned shape, and the backend rejects parent indices that do not refer to preceding nodes. `LearningPath.generation` freezes the original curriculum, evidence, provider/model, assessment, and timestamp; each node retains its original evidence IDs. Later learner edits do not change that snapshot or claim to have been re-evaluated. Older journeys use an empty generation record, which the UI labels as unrecorded.

The path, its nodes, selected sources, initial location, and creation activity are committed together. Existing nodes keep stable IDs when renamed, reordered, or reparented. Reparenting cannot introduce a cycle or cross into another path. Node deletion is limited to empty, unstarted nodes without retained history or children, and a path must retain a node.

| Boundary | Invariant |
| --- | --- |
| Primary conversation | Interactions match the node and have no thread ID. |
| Exploratory thread | Interactions match one thread; its saved seed gives the starting context. |
| Withheld answers | Questions remain available for continuity, but rejected answer text is excluded from model history and thread seeds. Existing legacy seeds are sanitized when building context without changing the saved records. |
| Thread activity | Does not change primary-node messages, completion state, or workspace location. Navigation changes location explicitly. |
| Progress | `not_started`, `in_progress`, or `completed`; the first primary interaction marks an unstarted node in progress, and the learner controls completion. Path progress is the rounded percentage of completed nodes. It is not a mastery estimate. |
| Navigation | A saved thread must belong to the saved node, and the node must belong to the saved path. |
| Sources | Retrieval uses sources attached to the current path, or explicitly selected unattached sources while creating a path. |
| Notebook | Saved response/excerpt origin and evidence copies remain unchanged when a learner edits or moves the retained text. |
| Study selection | A persisted, ordered list of existing notebook item IDs; deleting an item removes it from selections. |
| PDF export | A frozen snapshot of explicitly selected items in the requested order; later note edits cannot alter an existing export. |

Learning activity records preserve the path, node, thread, activity label, and timestamp. Learning-session records capture an explicit study period and its last location; the learner can end a period from History. These differ from study selections, which are ordered reading sets used for review and export.

Route changes persist node/thread study location, including browser Back/Forward and direct links. TanStack Query serializes location writes so a slower earlier navigation cannot overwrite the most recent destination. A path-only selection preserves its existing study location, or restores that path's last learning-session location when switching journeys. Opening the curriculum therefore does not clear the node/thread that Home resumes.

Each learning journey owns one notebook across visits. The notebook is the collection of that journey's **sections**, so a second notebook entity or creation flow is unnecessary. The database and API retain the existing `NotebookPage` name for sections. Sections, notes, study selections, and exports carry their journey's `path_id`. The API rejects foreign-journey origins, section moves, selection IDs and export IDs; the UI also queries only the chosen journey. Personal notes inherit the section's journey without inventing an originating node. A section can contain many notes; PDF pagination is a separate rendering concern. Saving a response requires an accepted answer, while evidence excerpts and personal notes can be retained independently. Saving a scoped note records its origin and updates the journey and study-session activity timestamps.

The notebook migration preserves content, origin snapshots and IDs. It assigns sections from recorded note origins or export history and splits mixed sections by known journey. Unscoped notes inherit a section's owner only when it is unambiguous. Unresolved legacy sections/selections remain stored and read-only rather than being assigned to an unrelated journey; old PDFs remain downloadable and their snapshots are unchanged.

## Providers and embeddings

Chat generation can use Azure OpenAI, OpenAI, OpenRouter, or Ollama through the OpenAI SDK's compatible clients. Provider/model selection is persisted in `AppSettings`. Credentials and service endpoints are loaded on the server from the root `.env`; API responses never return keys. The selected model must support structured JSON schema output. The Settings connection test checks that capability for the chosen model.

Embeddings are configured independently through `EMBEDDING_PROVIDER`, `EMBEDDING_MODEL`, and embedding dimensions. Azure can use its separately named embedding deployment and dimensions. Changing the chat model does not force the source corpus to be embedded again or silently send embedding requests to a different provider.

Each stored chunk records an embedding profile containing provider, embedding model/deployment name, and dimensions. Retrieval filters both profile and vector dimensions before calculating cosine distance. After changing the embedding configuration, reindex the sources; old vectors are not automatically converted. Also reindex if an endpoint or deployment is changed to serve a different embedding model under the same configured name.

Choosing Ollama for chat alone does not make every AI request local: the embedding provider can still be Azure or another remote service. Fully local inference requires a running local chat model and a local embedding model with the correct dimensions. Web retrieval still needs internet access. Individual model support must be checked with the provider connection test.

## Persistence and background work

SQLModel defines the domain tables, Alembic manages schema migrations, and PostgreSQL stores paths, interactions, sources, chunks, progress, sessions, notebook content, preferences, and export records. Original uploaded files and generated PDFs live under `DATA_DIR` (normally `.data`). Preserve both the database volume and this directory when backing up or moving the workspace.

Source uploads and URL/text submissions create a durable `pending` record before returning. FastAPI background tasks claim it for processing using a separate database session. Parsing and embedding must finish before old chunks are replaced. A failure records an actionable error and preserves the prior index data. The source screen exposes processing state and retry/reindex actions. On startup, a recovery thread resumes sources left pending or processing by an interrupted run.

This is a single-process local application. The task record is durable, but the running worker is part of the API process. Redis and Celery are deliberately unnecessary for this workload: restarting the API recovers source work from PostgreSQL. This design does not claim independent worker availability or support several API worker processes.

PDF generation runs in FastAPI's request worker thread because local study selections are short jobs. An export record and ordered snapshot are saved before rendering. Completed records expose a download URL; failed records keep an error and retain all notes and selection state. An interrupted pending export is marked failed at the next startup and can be recreated from the saved selection. New exports store relative file paths. Downloads derive their location from the export ID and current `DATA_DIR`, including for matching legacy host-mode records, so the same database and data directory work after a Docker mount changes the absolute path.

## Library reuse

| Capability | Library and application-specific work |
| --- | --- |
| UI and server state | Next.js, React, TanStack Query; Trellis supplies the learning screens and invalidates affected queries after writes. |
| Curriculum graph | React Flow; Trellis maps stable nodes and their parent relationships to graph elements. |
| HTTP and schemas | FastAPI and Pydantic; Trellis defines request contracts and scope rules. |
| Persistence and vectors | SQLModel, SQLAlchemy, Alembic, psycopg, pgvector; Trellis supplies its domain schema and source/profile filters. |
| AI protocols | OpenAI SDK; Trellis supplies provider configuration, structured response schemas, evidence prompts, and acceptance gates. |
| Parsing | pypdf for text PDFs and Trafilatura for readable web articles; Trellis retains page/character provenance. Scanned PDFs require OCR before upload. |
| Chunking | LangChain's `RecursiveCharacterTextSplitter`; Trellis stores each chunk with its source, location, and embedding profile. |
| Search and fetching | DDGS discovers public URLs; HTTPX fetches bounded content. Trellis validates destinations and redirects before indexing. |
| Markdown and PDF | markdown-it-py parses Markdown; ReportLab lays out text, lists, tables, code, sources, and page furniture. Trellis maps notebook snapshots into those flowables. |
| Verification | pytest and FastAPI TestClient use isolated PostgreSQL schemas; PyMuPDF reopens PDF text and renders pages for visual review. |

The main files to follow are `core.py` for curriculum and scoped interactions, `ai.py` for provider/answer policy, `evidence.py` and `provider_routes.py` for sources, and `notebook.py` for retained material and exports. Their corresponding tests exercise behavior without spending real model calls; live provider and browser checks remain separate acceptance evidence.
