# processing-control Specification

## Purpose
TBD - created by archiving change add-finance-data-api-mvp1. Update Purpose after archive.
## Requirements
### Requirement: News processing state
The system SHALL allow an agent to mark news items as processed with processor identity, timestamp, and optional notes.

#### Scenario: Mark news processed
- **WHEN** an agent marks a news item as processed
- **THEN** the system records the processing state and excludes the item from unprocessed-news queries by default

### Requirement: Operation review state
The system SHALL allow an agent or client to mark operations as reviewed with reviewer identity, timestamp, and optional notes.

#### Scenario: Mark operation reviewed
- **WHEN** a client marks an operation as reviewed
- **THEN** the system records the review state without changing the operation facts

### Requirement: Snapshot processing state
The system SHALL allow clients to record snapshot creation and retrieve the latest snapshot metadata.

#### Scenario: Query latest snapshot
- **WHEN** a client requests the latest snapshot
- **THEN** the system returns the newest snapshot metadata and captured timestamp

### Requirement: Pending work query
The system SHALL provide a pending work query that lists unprocessed news,
unclassified news, unreviewed or revision-requested current classifications,
unreviewed operations, and missing or stale snapshot indicators as separate
work categories.

#### Scenario: List pending processing items
- **WHEN** an agent requests pending processing items
- **THEN** the system returns the pending items grouped by type with stable identifiers and does not conflate news processing with classification or review state

### Requirement: Processing state auditability
The system SHALL keep processing state changes auditable and separate from immutable factual fields.

#### Scenario: Preserve fact data during processing update
- **WHEN** processing state is updated for a news item or operation
- **THEN** the system updates only processing metadata and leaves factual fields unchanged

### Requirement: Classification review state
The system SHALL maintain classification review as append-only auditable state
separate from classification inference and factual news processing.

#### Scenario: Review without changing inference
- **WHEN** a reviewer approves, rejects, or requests revision of a classification
- **THEN** the system appends review metadata and leaves classification and news factual fields unchanged

