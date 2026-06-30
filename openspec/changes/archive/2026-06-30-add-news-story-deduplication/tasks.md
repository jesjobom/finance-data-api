## 1. Data Model And Migration

- [x] 1.1 Add story cluster and story mention domain types with grouping reason, confidence, primary flag, status, and provenance fields.
- [x] 1.2 Add PostgreSQL migration for `news_story_clusters` and `news_story_mentions` with indexes for publication day, primary mention, news item identity, and grouping status.
- [x] 1.3 Extend in-memory and PostgreSQL stores to create, update, list, and retrieve story clusters and mentions.
- [x] 1.4 Add migration/backfill behavior that creates one-item clusters for existing news and groups exact canonical URL matches without deleting news records.

## 2. Grouping Engine

- [x] 2.1 Implement canonical URL normalization and exact same-day grouping against stored news items.
- [x] 2.2 Implement bounded same-day cross-source semantic candidate selection.
- [x] 2.3 Add semantic comparison interface for title, summary/body, key entities, event type, and factual outcome signals.
- [x] 2.4 Persist grouping reason, confidence, diagnostics, and review/conflict state for each linked mention.
- [x] 2.5 Implement deterministic primary mention selection using source priority, accessible content, title clarity, publication time, and access limitations.

## 3. Ingestion Integration

- [x] 3.1 Invoke post-ingestion story grouping after source records are persisted during collection.
- [x] 3.2 Keep collection counts source-scoped when items are grouped into story clusters.
- [x] 3.3 Add run diagnostics for grouping phase outcomes without storing unbounded source payloads.
- [x] 3.4 Add tests for canonical exact grouping, semantic grouping, false-positive avoidance, and cross-day non-grouping.

## 4. Classification And Work Queues

- [x] 4.1 Add cluster-level classification support or effective classification projection from existing mention classifications.
- [x] 4.2 Update unclassified-news queue to return story clusters with no direct or mention-derived current classification.
- [x] 4.3 Exclude clusters with mention-derived classifications from unclassified queues and expose `classificationSource` metadata.
- [x] 4.4 Detect conflicting mention classifications and route them to review instead of silently choosing one.
- [x] 4.5 Mark already-classified clusters with materially richer new duplicate mentions as review candidates without auto-superseding the classification.

## 5. API Contract And Documentation

- [x] 5.1 Add OpenAPI schemas for story clusters, story mentions, grouping provenance, effective classification source, conflict state, and new-evidence review indicators.
- [x] 5.2 Update unclassified queue response schemas to return cluster-aware entries with `primaryNews` and bounded `alsoSeenIn` mention data.
- [x] 5.3 Update API/runtime contract tests for cluster retrieval, mention detail links, and mention-derived classification status.
- [x] 5.4 Update agent/operator docs for interpreting story clusters and duplicate mention evidence.

## 6. Scheduled Agent Instructions And Rollout

- [x] 6.1 Update scheduled news collection instructions so the agended agent runs canonical URL grouping first and same-day cross-source semantic grouping second after ingestion.
- [x] 6.2 Document that adding a duplicate mention does not mutate existing cluster classification by default.
- [x] 6.3 Add rollout notes for backfill, conservative thresholds, and review handling for uncertain or conflicting groups.
- [x] 6.4 Before archiving this OpenSpec change, verify the scheduled-agent instructions and documentation updates are committed with the implementation.

## 7. Validation

- [x] 7.1 Run targeted story grouping, ingestion, classification queue, and pending-work tests.
- [x] 7.2 Run migration tests against in-memory and PostgreSQL-backed stores where available.
- [x] 7.3 Run typecheck, full test suite, and strict OpenSpec validation.
