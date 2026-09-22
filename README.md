# Trellis

## An AI-Powered Learning Engine

> Learn as a connected journey, not a collection of conversations.

Trellis is a structured, context-preserving, and persistent learning environment. It turns a learning goal into a navigable curriculum, gives the learner a focused AI-assisted workspace for each topic, and keeps progress, exploration, evidence, and useful study material connected across sessions.

## Why Trellis exists

Conversational AI is good at explaining individual concepts, but long learning journeys can become fragmented. Related questions can pull a conversation away from its main topic, progress is difficult to resume, and useful explanations are rarely organized into a learner-owned study system.

Trellis addresses this by organizing learning around a curriculum structure instead of a single chat:

~~~text
Learning goal
      |
      v
Structured learning path
      |
      v
Active learning node
      |
      +--> Scoped AI interaction
      |
      +--> Exploratory thread
      |
      v
Persistent progress, evidence, and study material
~~~

## What Trellis provides

- **Structured learning paths** - Turn a goal, topic, or supplied curriculum into topics, subtopics, and learning nodes.
- **Node-based learning** - Give every topic its own focused learning environment and context.
- **Context-preserving exploration** - Follow related concepts in independent threads without changing the primary learning path.
- **Evidence-aware assistance** - Associate generated learning content with relevant sources and expose grounding and quality signals.
- **Persistent learning state** - Preserve progress, history, active location, and session state so the learner can continue later.
- **Learner-owned knowledge** - Save explanations, examples, source excerpts, and personal notes in a structured notebook.
- **Study-session export** - Organize selected material and export it as a readable PDF.

Trellis is intended to be more than an AI tutor. Its purpose is to manage the structure, context, progression, and accumulated study material of the learning process.

## Current status

The repository currently contains the Trellis web UI prototype, converted from the original Vite scaffold to Next.js.

Implemented in the UI:

- Landing and product introduction screen.
- Learning dashboard.
- Learning journey creation flow.
- Curriculum graph view.
- Node-level learning view.
- Exploratory thread interaction mockup.
- Notebook view.
- Client-side navigation and demo state.

Not implemented yet:

- Backend API.
- Database-backed persistence.
- Real LLM integration.
- Evidence retrieval and pgvector indexing.
- Grounding evaluation.
- Authentication and multi-user workspaces.
- Real notebook persistence and PDF generation.

The current UI uses representative demo data and local client state. It communicates the intended product experience but should not be mistaken for the completed learning engine.

## Technology direction

### Current frontend

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS v4
- PostCSS
- pnpm

### Planned product architecture

- Next.js + TypeScript frontend.
- Python + FastAPI backend.
- PostgreSQL for application state.
- pgvector for semantic evidence retrieval.
- Model-independent LLM and embedding integrations.
- Redis and Celery for work that needs background execution.
- Docker for reproducible local and deployment environments.

The planned architecture keeps learning-path state and context rules in the application domain, while treating LLM, retrieval, evaluation, and export systems as replaceable integrations.

## Repository structure

~~~text
.
├── README.md
└── ui/
    ├── src/
    │   ├── app/       # Next.js App Router shell
    │   ├── screens/   # Trellis UI screens
    │   ├── App.tsx    # Client-side demo application shell
    │   └── index.css  # Global styles and Tailwind theme
    ├── next.config.ts
    ├── package.json
    └── pnpm-lock.yaml
~~~

## Run the UI locally

~~~bash
cd ui
pnpm install
pnpm dev
~~~

Open [http://localhost:3000](http://localhost:3000).

Useful checks:

~~~bash
cd ui
pnpm typecheck
pnpm build
pnpm start
~~~

## Implementation roadmap

### Phase 1 - Foundation and core learning loop

Build the persistent learning loop:

~~~text
Goal -> Curriculum -> Node -> Scoped interaction
     -> Exploratory thread -> Progress -> Resume
~~~

This phase establishes the domain model, frontend/backend boundary, database persistence, node context, thread isolation, and session resumption.

### Phase 2 - Evidence, retention, export, and evaluation

Complete the academic prototype with:

- Evidence ingestion and semantic retrieval.
- Evidence-associated generation.
- Grounding and quality evaluation.
- Notebook and study-session persistence.
- Structured PDF export.
- Background jobs where they are genuinely needed.
- Integration, scenario-based, and failure-path testing.

## Explicit non-goals

Trellis is not currently intended to be:

- A conventional LMS or course marketplace.
- A generic ChatGPT clone.
- A fully autonomous mastery-based education platform.
- A replacement for teachers or academic institutions.
- A system that guarantees factual correctness merely because content has citations.
- A project claiming statistically proven improvement in educational outcomes without a separate study.

The first objective is to demonstrate the technical and functional feasibility of a structured, persistent, context-preserving AI learning environment.

## Documentation

The detailed requirements and phased implementation plan are maintained as project planning artifacts alongside the repository. They define the intended behavior, scope, acceptance scenarios, architecture direction, and delivery plan.
