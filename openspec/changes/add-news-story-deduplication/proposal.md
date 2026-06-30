## Why

News collection intentionally preserves per-source records, but repeated coverage
of the same story creates duplicate classification work and makes downstream
queues noisier. Grouping same-day cross-source coverage into story clusters lets
agents classify the factual event once while still retaining every publisher
mention as evidence.

## What Changes

- Add story-level deduplication for news items through explicit clusters and
  source mentions.
- Keep every collected `news_items` record, including items considered duplicate
  coverage, and expose duplicate coverage as `alsoSeenIn`/mention metadata.
- Use canonical URL matching as the deterministic first pass, followed by
  same-day cross-source semantic grouping when URLs differ but the factual event
  is equivalent.
- Treat classification as effective at the story-cluster level for work queues:
  a cluster with any current mention-derived or cluster classification is not
  returned as unclassified by default.
- Do not change an existing cluster classification only because a new duplicate
  mention arrives; mark relevant new evidence or conflicts for review instead.
- Add a pre-archive non-functional requirement to update the scheduled news
  collection agent instructions so it performs semantic duplicate checks during
  post-ingestion grouping.

## Capabilities

### New Capabilities

- `news-story-deduplication`: Story clusters, mention relationships, grouping
  reasons, representative item selection, and duplicate evidence handling.

### Modified Capabilities

- `news-source-ingestion`: Add post-ingestion same-day cross-source story
  grouping to the collection pipeline and scheduled-agent workflow.
- `news-classification`: Classify story clusters using all available mentions
  and derive effective cluster classification from existing mention
  classifications.
- `api-contract`: Expose story cluster/mention shapes and unclassified queue
  behavior in the checked-in API contract.
- `processing-control`: Keep pending work queues cluster-aware and separate
  unclassified, review, conflict, and new-evidence states.

## Impact

- Adds persistence for story clusters and news-to-story mention relationships,
  including match reason, confidence, primary mention selection, and evidence
  metadata.
- Updates news collection orchestration to run a post-ingestion grouping phase
  after items are persisted.
- Updates classification queues and pending work queries to operate on story
  clusters while preserving compatibility with existing news-item
  classifications.
- Updates OpenAPI schemas, API tests, ingestion tests, classification tests, and
  agent/operator documentation for scheduled collection behavior.
