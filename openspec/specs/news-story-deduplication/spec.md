# news-story-deduplication Specification

## Purpose
TBD - created by archiving change add-news-story-deduplication. Update Purpose after archive.
## Requirements
### Requirement: Story clusters preserve publisher mentions
The system SHALL group duplicate coverage into story clusters while preserving
each collected publisher news item as a separate mention with its original
source, URL, title, content fields, timestamps, and audit metadata.

#### Scenario: Group duplicate cross-source coverage
- **WHEN** two news items from different sources are determined to cover the same factual event on the same publication day
- **THEN** the system links both news items to one story cluster and preserves both source records unchanged

#### Scenario: Keep non-duplicate same-topic coverage separate
- **WHEN** two news items share subjects or entities but describe different factual events or materially different outcomes
- **THEN** the system keeps them in separate story clusters

### Requirement: Deterministic URL grouping pass
The system SHALL attempt deterministic grouping by normalized canonical URL
before invoking semantic duplicate comparison.

#### Scenario: Match normalized canonical URL
- **WHEN** two same-day news items from different sources resolve to the same normalized canonical URL
- **THEN** the system links them to the same story cluster with an exact URL grouping reason

#### Scenario: Preserve distinct canonical URLs for semantic review
- **WHEN** two news items have different normalized canonical URLs
- **THEN** the system does not treat the URL comparison as sufficient and may evaluate them through the semantic grouping pass

### Requirement: Same-day semantic story grouping
The system SHALL support semantic duplicate grouping only among bounded
same-day, cross-source candidates using title, summary, body when available,
key entities, event type, and factual outcome signals.

#### Scenario: Group same event with different titles
- **WHEN** same-day items from different sources use different titles but share the same core entities, event type, and factual outcome
- **THEN** the system links them to the same story cluster with semantic match reason and confidence metadata

#### Scenario: Avoid cross-day semantic grouping
- **WHEN** two items appear on different publication days
- **THEN** the semantic duplicate pass does not automatically group them even if their text is similar

#### Scenario: Bound semantic candidate scope
- **WHEN** the grouping service evaluates semantic duplicates
- **THEN** it restricts comparisons to bounded same-day candidates from different sources before using model-based or embedding-based similarity

### Requirement: Primary mention selection
The system SHALL select one primary mention per story cluster for display and
agent context without hiding non-primary mentions.

#### Scenario: Select richest representative
- **WHEN** a story cluster contains multiple mentions
- **THEN** the system selects the primary mention using deterministic quality signals such as source priority, accessible summary or body, title clarity, publication time, and access limitations

#### Scenario: Expose non-primary mentions
- **WHEN** a client retrieves a clustered story
- **THEN** the response exposes non-primary mentions as additional source evidence rather than suppressing them entirely

### Requirement: Grouping provenance and review state
The system SHALL store grouping reason, confidence, creation metadata, and
review/conflict state for story-cluster mentions.

#### Scenario: Inspect grouping provenance
- **WHEN** an agent retrieves a story cluster
- **THEN** it can identify whether each mention was linked by canonical URL, semantic match, manual action, or backfill and can inspect bounded confidence metadata

#### Scenario: Flag uncertain grouping
- **WHEN** a semantic match falls below the automatic grouping threshold but above the review threshold
- **THEN** the system does not merge the items automatically and records the candidate relationship for review if review support is enabled

### Requirement: Duplicate mentions do not mutate classification by default
The system SHALL NOT automatically change an existing effective story
classification solely because a new duplicate mention is added to the cluster.

#### Scenario: Add duplicate to classified cluster
- **WHEN** a new duplicate mention is linked to an already classified story cluster
- **THEN** the existing effective classification remains current by default and the new mention is recorded as additional evidence

#### Scenario: Mark relevant new evidence
- **WHEN** a new duplicate mention is materially richer, from a higher-priority source, or conflicts with prior evidence
- **THEN** the system marks the cluster for review or refresh without silently superseding the current classification

