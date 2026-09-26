# Demo review fixes — 25 September 2026

The Python and Learning System Design walkthrough review identified draft loss, weak read-error recovery, malformed code citations, noisy source extraction, and navigation/readability gaps.

## Changes

- Notebook edits are retained per journey and note in the current browser tab. Search, navigation, reload, section moves, failed saves, and delayed saves preserve drafts. Save persists the note; Discard draft clears only that note's local draft.
- Transient API reads get one automatic retry. Failed node/thread loads offer Retry. Model-generation and save requests are never automatically replayed.
- New answer citations are separated from Markdown blocks. Existing malformed closing fences are repaired for display and new response exports without rewriting stored answers.
- Inline citations focus and expand the matching passage. Other long passages start collapsed, and long text wraps within the panel.
- Extraction excludes Microsoft Learn's hidden authorization template while retaining visible errors and public article content.
- Flat curricula display a numbered learning sequence. Existing parent-child relationships remain unchanged; sequence arrows are explicitly distinguished from prerequisites.
- Status labels describe current topics, parent summaries, and answer coverage accurately. Completing the last-position topic offers a route back to remaining topics.
- History records exact response/note destinations. Notebook origin links reopen the original response or thread. Historical sessions show journey/topic labels and Resume.
- Study selections include a combined reading preview in the saved export order. New PDFs embed clickable source URLs.

## Compatibility

Migration `a47d8e290c61` adds nullable History destination IDs. Unambiguous old question events recover their response ID. Old notebook events retain a journey-notebook fallback because edited/deleted titles cannot reliably identify the original note. Notes and historical exports remain intact.

Previously indexed source text, saved evidence snapshots, and existing PDF files are not rewritten. Re-indexing uses the cleaned extraction; creating a new PDF uses the corrected formatter and source links. Unsaved drafts survive navigation/reload in their browser tab; saving is required for durable backend storage.

## Verification

- 69 PostgreSQL-backed backend tests passed in isolated schemas, including migration preservation and node/thread isolation.
- 41 browser regressions passed, covering existing flows and the new fixes. API fixtures deliberately inject transient reads, failed writes, and delayed saves.
- Python lint, TypeScript, production Docker build, `git diff --check`, and Alembic model/migration alignment passed.
- The local production demo was rebuilt and restarted on port 3100. Before/after migration counts and content hashes matched for all 13 checked learning tables, including 5 journeys, 38 nodes, 16 interactions, and 12 notebook items. A database backup is retained in `.data/demo-review/before-fixes-database.dump`.
- Live browser checks on both existing demo journeys verified code formatting, evidence focus, curriculum layout, notebook draft recovery, origin links, History, and reading order. Browser checks preserved the saved resume location and reported no page errors or failed reads.
- Four spaced reads through the production proxy returned HTTP 200. Fault-injection tests separately prove automatic and manual recovery; the original socket reset's infrastructure trigger remains unproven.
- One additional Python PDF was exported through the running API, parsed and rendered for inspection. Code formatting and URI annotations passed; original notes, selection, prior export records, and original PDF bytes were unchanged.

Local screenshots and machine-readable verification records are under `.data/demo-review/`.
