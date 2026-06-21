## ADDED Requirements

### Requirement: Classification review state
The system SHALL maintain classification review as append-only auditable state
separate from classification inference and factual news processing.

#### Scenario: Review without changing inference
- **WHEN** a reviewer approves, rejects, or requests revision of a classification
- **THEN** the system appends review metadata and leaves classification and news factual fields unchanged

## MODIFIED Requirements

### Requirement: Pending work query
The system SHALL provide a pending work query that lists unprocessed news,
unclassified news, unreviewed or revision-requested current classifications,
unreviewed operations, and missing or stale snapshot indicators as separate
work categories.

#### Scenario: List pending processing items
- **WHEN** an agent requests pending processing items
- **THEN** the system returns the pending items grouped by type with stable identifiers and does not conflate news processing with classification or review state
