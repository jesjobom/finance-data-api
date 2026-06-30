## MODIFIED Requirements

### Requirement: Pending work query
The system SHALL provide a pending work query that lists unprocessed news,
unclassified story clusters, story clusters with classification conflicts or
new evidence needing review, unreviewed or revision-requested current
classifications, unreviewed operations, and missing or stale snapshot indicators
as separate work categories.

#### Scenario: List pending processing items
- **WHEN** an agent requests pending processing items
- **THEN** the system returns the pending items grouped by type with stable identifiers and does not conflate news processing, story classification, grouping review, or classification review state

#### Scenario: List duplicate grouping review work
- **WHEN** a story cluster has conflicting classifications or materially relevant new duplicate evidence after classification
- **THEN** the pending work query lists it in a review category rather than returning it as ordinary unclassified work
