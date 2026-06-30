## ADDED Requirements

### Requirement: Post-ingestion story grouping phase
The system SHALL run a story grouping phase after news candidates are persisted
by source collection so duplicate detection can reference stored news items
without blocking item registration.

#### Scenario: Group after persistence
- **WHEN** a collection run creates or enriches news items
- **THEN** the system persists the source records first and then evaluates them for same-day story grouping

#### Scenario: Preserve collection counts
- **WHEN** two collected items are grouped into one story cluster
- **THEN** collection created, enriched, and duplicate counts continue to describe source-scoped ingestion rather than deleting or hiding either item

### Requirement: Scheduled agent duplicate grouping instructions
The scheduled news collection agent SHALL include explicit post-ingestion
instructions to perform canonical URL grouping first and same-day cross-source
semantic duplicate checks second.

#### Scenario: Run agended collection with semantic grouping
- **WHEN** the scheduled collection agent completes source ingestion for a run
- **THEN** it follows documented instructions to evaluate same-day cross-source semantic duplicates and records grouping provenance

#### Scenario: Pre-archive instruction update
- **WHEN** this OpenSpec change is prepared for archive
- **THEN** the scheduled collection agent instructions and operator documentation have been updated to describe the semantic duplicate grouping phase and its conservative non-mutating classification behavior
