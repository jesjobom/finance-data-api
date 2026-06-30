## Context

The news ingestion pipeline already stores source-scoped `news_items`, canonical
URLs, and a `duplicate_group` field, but duplicate grouping is currently URL
or hash oriented. Cross-source coverage of the same factual event often has
different publisher URLs and titles, so URL canonicalization alone cannot
collapse classification work safely.

The desired behavior is cluster-oriented: keep every publisher item, group
same-day duplicate coverage into a story, classify the story once, and surface
all mentions as evidence. Existing news-item classifications must remain valid
because some items may already be classified before grouping is introduced.

## Goals / Non-Goals

**Goals:**

- Preserve every collected news item and publisher URL.
- Add story clusters as the unit of duplicate grouping and classification work.
- Support deterministic URL/canonical grouping before semantic grouping.
- Restrict semantic grouping to same-day, cross-source candidates to control
  cost and false positives.
- Expose cluster mentions through APIs so suppressed/duplicate coverage remains
  visible as evidence.
- Treat new duplicate mentions as non-mutating evidence by default.
- Require scheduled-agent instruction updates before this change is archived.

**Non-Goals:**

- Removing or merging publisher news records.
- Replacing all news-item classifications in one migration.
- Building a general multi-day topic clustering engine.
- Automatically superseding classifications whenever later coverage arrives.
- Treating same-subject but different-event reporting as duplicate coverage.

## Decisions

### Add explicit story cluster and mention state

Create a story-level model rather than overloading `duplicate_group` as the only
grouping mechanism. A cluster represents the factual event; mention rows link
individual `news_items` to that cluster with `matchReason`, `confidence`,
`isPrimary`, and optional grouping diagnostics.

Alternative considered: keep using `duplicate_group` on `news_items`. That is
sufficient for exact canonical URL grouping, but it cannot express multiple
mentions, primary selection, classifier provenance, conflicts, or review state
without turning a scalar field into an implicit data model.

### Use a two-pass grouping pipeline

Post-ingestion grouping first attempts deterministic matches using normalized
canonical URLs. If no exact match is found, it evaluates only same-day,
cross-source candidates with semantic comparison based on title, summary/body
when available, entities, event type, and factual outcome.

Alternative considered: run semantic comparison on every item pair. That would
be more expensive and riskier, and it would invite stale multi-day topic
clusters that are outside the requested scope.

### Classify clusters, inherit existing mention classifications

New classification work queues should operate on story clusters. A cluster is
effectively classified if it has a current cluster classification or a current
classification on any linked mention. The source classification remains
auditable through `classificationSource`.

Alternative considered: force reclassification of every cluster after grouping.
That wastes prior classifier work and can overwrite useful evidence from a
non-primary mention.

### Do not auto-update classification for new duplicate mentions

When a new mention joins an already classified cluster, the classification is
left unchanged by default. The system records new evidence and may mark the
cluster for review if the new mention is richer, higher priority, or creates a
classification conflict.

Alternative considered: automatically supersede the classification on every new
mention. That creates unstable outputs and increases classifier cost for little
benefit on ordinary duplicate coverage.

### Select the primary mention by quality, not insertion order

The primary mention is the best representative for display and agent context.
Selection should consider source priority, accessible summary/body, title
clarity, publication time, and paywall/access limitations.

Alternative considered: first-seen wins. That is deterministic but can bury the
most useful source under a thin feed entry.

## Risks / Trade-offs

- False positive semantic groups -> Use same-day/cross-source candidate
  windows, conservative confidence thresholds, explicit match reasons, and
  conflict/review states.
- False negatives keep duplicate work -> Prefer missing a group over merging
  unrelated events; operators can later add manual merge support if needed.
- Existing news-item APIs expect item-level queues -> Add cluster-aware
  response shapes while preserving item provenance and compatibility paths.
- Semantic comparison cost grows with source volume -> Pre-filter candidates by
  date, source difference, canonical URL, key entities, and bounded result
  counts before invoking model-based comparison.
- Classification provenance becomes more complex -> Store whether an effective
  classification came from the cluster or from a specific mention.

## Migration Plan

1. Add cluster and mention persistence with indexes for publication date,
   canonical URL/grouping fingerprint, and cluster status.
2. Backfill clusters for existing news items using canonical URL/fallback
   one-item clusters, without merging records.
3. Add grouping service and run it after source collection persistence.
4. Update unclassified and pending-work queries to return clusters while
   preserving mention references.
5. Update classification submission/retrieval to support cluster provenance and
   mention-derived effective classification.
6. Update API schemas, tests, and operator/agent documentation.
7. Before archiving the change, update scheduled news collection instructions
   so the agended agent performs semantic duplicate checks in the post-ingestion
   phase.
