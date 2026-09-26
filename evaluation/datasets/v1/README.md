# Trellis evidence benchmark v1

**Review status: pending human review.** All questions, passages, expected answers, and labels were authored by AI. Every case and source has `human_reviewed: false`. This version must not be described as independently human-labelled or human-validated.

This is a small fixed reference set for offline evaluation of evidence retrieval, answer relevance and completeness, grounding, abstention, source restrictions, and conversational question resolution. The expected answers were authored before benchmark execution, not copied from the generator being evaluated.

## Files and counts

- `cases.jsonl`: 96 questions with context, history, available source IDs, reference answers, relevant source IDs, and allowed result statuses.
- `sources.jsonl`: 80 short passages: 64 supplied-source fixtures and 16 fixed web fixtures. Forty passages are curated references, including eight web copies; forty are explicitly fictional fixtures. No passage exceeds 540 characters in this version.
- `manifest.json`: version, counts, family membership, split policy, provenance, review status, and limitations.

| Category | Dev | Test | Total |
| --- | ---: | ---: | ---: |
| Normal questions | 8 | 8 | 16 |
| Follow-ups and explicit topic switches | 8 | 8 | 16 |
| Comparisons | 8 | 8 | 16 |
| Conflicting documents | 8 | 8 | 16 |
| Missing evidence | 8 | 8 | 16 |
| Source constraints | 8 | 8 | 16 |
| **Total** | **48** | **48** | **96** |

Each of the eight families contains two cases in each category. Dev covers Python collections, HTTP caching, throughput/scaling, and Python concurrency. Test covers relational SQL, Git, queue delivery, and DNS/TCP networking. Families, fictional projects, and source IDs are disjoint between splits. Each split uses passages from its own families as distractors. The split prevents a topic's near-paraphrases from appearing in both dev and test; it is a workflow convention, not a hidden or blinded test set.

Use dev while selecting prompts, retrieval settings, and thresholds. Evaluate test after those decisions are fixed. If developers inspect individual test answers or tune against them, record that exposure and prepare fresh held-out families before claiming an untouched test result. The public test file cannot provide secrecy.

## Interpretation of labels

`source_ids` and `web_source_ids` are the available candidate pools, not an ordered gold ranking. Their order is fixed by sorting the SHA-256 hash of `v1:case_id:source_id`, independently of gold labels, so relevant passages are not systematically placed first. Normal cases generally have twelve supplied candidates; forced web-fallback cases have eleven supplied distractors and one relevant web passage. Each family's last public reference has a same-split web copy, but the two copies are never simultaneously available in an evidence-answerable case. Fixed web fixtures simulate a fallback result and never imply that a live search occurred.

`gold_source_ids` lists the passages required to establish the reference answer. A comparison may need one passage that describes both alternatives or several passages. A conflicting-document case needs both drafts. Do not count every available source as relevant.

Twenty-four evidence-absent cases have empty gold: eight unknown project facts, eight general questions with no evidence, and eight unread-document requests. Recall and ranking metrics with a positive-gold denominator are undefined for these cases; exclude them from those averages and report their count. They remain valuable for status, source restriction, and unsupported-claim checks.

The allowed statuses are deliberately narrow:

- `answered` (72 cases): provide the supported factual core. In conflict cases, report both claims and the absence of a rule selecting an authoritative draft. Do not invent a reconciliation or silently choose a winner.
- `abstained` (16 cases): a specific missing project fact or unread document cannot be answered. State the evidence limitation without inventing a number, private fact, quotation, or document attribution.
- `unverified` (8 cases): a general educational question has no evidence and no source-only restriction. Give a useful general explanation labelled unverified, without citations or claims of searching or verification.

`expected_answer` is a concise semantic reference, including any necessary limitation. It is not an exact-match response template, and its instructions about labelling can be satisfied by the application's visible status/notice as well as prose. Correct arithmetic, paraphrases, or examples are acceptable if they preserve the factual core. `expected_resolved_question` is populated for sixteen conversational cases and should also be assessed semantically. Half use an elliptical follow-up tied to the most recent relevant discussion; half explicitly change topic despite an older thread title. History marked `unverified` supplies conversational scope, not authoritative evidence.

`sources_only` is the initial checkbox/context state. Unread-document questions leave it false so the resolver must recognize the restriction in the learner's words. Supplied-policy cases set it true and include conflicting fixed web material: the answer must follow the named supplied policy. An unread source is modelled as no readable indexed passage; the dataset does not exercise document ingestion failure itself.

## Source attribution

Public reference passages are original, concise AI-authored paraphrases with occasional stated arithmetic or illustrative examples. They are **not verbatim excerpts, fetched page snapshots, or a claim that the URL was verified live**. URLs identify sources that a reviewer can use to check the concepts. The JSONL `provenance` object is the per-passage attribution record. Fictional project policies, incidents, limits, and public exercise listings are original benchmark material and use `url: null`.

| Family | Public references used for curated passages |
| --- | --- |
| Python collections | Python documentation: [sequences](https://docs.python.org/3/library/stdtypes.html#sequence-types-list-tuple-range), [sets](https://docs.python.org/3/library/stdtypes.html#set-types-set-frozenset), [dictionaries](https://docs.python.org/3/library/stdtypes.html#mapping-types-dict), [deque](https://docs.python.org/3/library/collections.html#collections.deque) |
| HTTP caching | IETF: [RFC 9111 response directives](https://www.rfc-editor.org/rfc/rfc9111.html#section-5.2.2), [freshness](https://www.rfc-editor.org/rfc/rfc9111.html#section-4.2), [RFC 9110 If-None-Match](https://www.rfc-editor.org/rfc/rfc9110.html#section-13.1.2), [RFC 9111 Vary matching](https://www.rfc-editor.org/rfc/rfc9111.html#section-4.1) |
| Throughput/scaling | Google SRE: [monitoring distributed systems](https://sre.google/sre-book/monitoring-distributed-systems/); Microsoft: [autoscaling](https://learn.microsoft.com/en-us/azure/architecture/best-practices/auto-scaling); MIT: [Little's law](https://web.mit.edu/urban_or_book/www/book/chapter2/2.7.5.html) |
| Python concurrency | Python documentation: [asyncio Task](https://docs.python.org/3/library/asyncio-task.html#task-object), [GIL considerations](https://docs.python.org/3/library/threading.html#gil-and-performance-considerations), [locks](https://docs.python.org/3/library/threading.html#lock-objects), [TaskGroup](https://docs.python.org/3/library/asyncio-task.html#task-groups) |
| Relational SQL | PostgreSQL documentation: [NULL comparisons](https://www.postgresql.org/docs/current/functions-comparison.html), [joins](https://www.postgresql.org/docs/current/queries-table-expressions.html#QUERIES-JOIN), [aggregate expressions](https://www.postgresql.org/docs/current/sql-expressions.html#SYNTAX-AGGREGATES), [transactions](https://www.postgresql.org/docs/current/tutorial-transactions.html) |
| Git | Git documentation: [branches](https://git-scm.com/book/en/v2/Git-Branching-Branches-in-a-Nutshell), [rebasing](https://git-scm.com/book/en/v2/Git-Branching-Rebasing), [reset](https://git-scm.com/docs/git-reset), [restore](https://git-scm.com/docs/git-restore) |
| Message delivery | RabbitMQ documentation: [consumer acknowledgements](https://www.rabbitmq.com/docs/confirms#consumer-acks), [publisher confirms](https://www.rabbitmq.com/docs/confirms), [prefetch](https://www.rabbitmq.com/docs/consumer-prefetch); Chris Richardson: [idempotent consumer pattern](https://microservices.io/post/microservices/patterns/2020/10/16/idempotent-consumer.html) |
| DNS/TCP networking | IETF: [RFC 1035 record TTL](https://www.rfc-editor.org/rfc/rfc1035.html#section-3.2.1), [RFC 9293 TCP service](https://www.rfc-editor.org/rfc/rfc9293.html#section-2.2), [RFC 768 UDP](https://www.rfc-editor.org/rfc/rfc768.html), [RFC 2308 negative caching](https://www.rfc-editor.org/rfc/rfc2308.html#section-5) |

The throughput family explicitly defines QPS as completed queries per second for its calculation examples. QPS counting conventions differ across real systems; this is a stated benchmark convention, not an assertion that every monitoring tool uses it. Python concurrency passages explicitly scope GIL claims to conventional GIL-enabled CPython builds. Fictional limits are local exercise policies, never limits imposed by Python, Git, HTTP, or a broker.

## Independent human review workflow

1. Assign a reviewer who did not generate these labels. Have them read the questions, available passages, and source attribution before viewing any model answer or automated judge score.
2. Check every factual reference against the cited documentation, including version/build assumptions. Correct errors in the passage and its expected answers together. Check fictional documents for clear scope and deliberate, unresolved conflicts.
3. For each case, independently confirm the required facts, minimal supporting passage IDs, allowed status, conversation referent, and source restriction. Flag any question that has several equally valid interpretations or any distractor that also fully answers it.
4. Record reviewer identity, date, decision, and label changes in a review artifact. Do not flip `human_reviewed` merely because an automated validator or model judge passed. Review source passages as well as cases.
5. Resolve disagreements with another human where possible. Freeze a new version of corrected labels before comparing generators. Keep v1 immutable for already-reported runs; changing gold after seeing an output invalidates a like-for-like comparison.
6. Separately calibrate automated answer judges on a balanced sample of actual dev outputs that includes good, wrong, unsupported, conflicting, abstained, and unverified responses. Compare independent human ratings with judge decisions and document disagreements. Reviewing reference labels alone does not validate the judge.

Until that workflow is completed, reports should say **AI-authored provisional benchmark; pending independent human review**. Structural validation, successful runner execution, or high scores do not change that status.

## Limits

This small English-only software-education set measures selected offline behaviors. It does not test live web discovery, source freshness, extraction/OCR, long-document chunking, production traffic, latency budgets, provider outages, UI flows, or the quality of all learning domains. Synthetic project fixtures deliberately make claims checkable inside the supplied passages. They should not be mistaken for observations about real projects.

The family split reduces direct question paraphrase leakage, but the same evaluation patterns exist across splits, and AI authorship can share biases with the generator or judge. Report sample sizes, exclusions, rubric details, and human-review status alongside metric values. A result on this version is not a production-readiness claim.
