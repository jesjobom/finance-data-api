## ADDED Requirements

### Requirement: News source registry API
The system SHALL document authenticated versioned endpoints to create, list,
retrieve, and update news sources, including stable filtering, current health,
validated adapter configuration, and non-secret operational metadata.

#### Scenario: Discover enabled core sources
- **WHEN** an authenticated agent requests enabled sources filtered by priority or editorial type
- **THEN** the API returns a documented, deterministically ordered source collection

#### Scenario: Reject invalid source update
- **WHEN** a client submits an endpoint, adapter configuration, schedule, or limit that violates the documented source schema
- **THEN** the API returns a structured validation error and leaves the source unchanged

### Requirement: News collection trigger API
The system SHALL document an authenticated versioned collection trigger that can
target due sources, all enabled sources, or explicit source identifiers and
returns per-source acquisition or run results, with every requested collection
window limited to the latest 24 hours relative to its fixed upper bound.

#### Scenario: Trigger selected sources
- **WHEN** an authenticated client submits explicit source identifiers
- **THEN** the API validates the selection and returns documented per-source run, skip, or lease-conflict results

#### Scenario: Reject an unbounded invalid trigger
- **WHEN** a trigger request exceeds documented source or concurrency limits
- **THEN** the API rejects it with a structured validation error before starting collection

#### Scenario: Reject a collection window older than one day
- **WHEN** a trigger request specifies a start earlier than 24 hours before its requested or assigned upper bound
- **THEN** the API returns a structured validation error and starts no collection run

### Requirement: News collection run API
The system SHALL document authenticated versioned endpoints to list and retrieve
collection runs by source, status, trigger, and bounded date interval.

#### Scenario: Query failed source runs
- **WHEN** an agent filters collection runs by source and failed status
- **THEN** the API returns deterministically ordered sanitized diagnostics using the documented response schema

### Requirement: News ingestion response schemas
The checked-in OpenAPI document SHALL define explicit request and response
schemas for source records, source health, trigger results, collection runs,
enriched news records, pagination or bounded list envelopes, and operational
errors.

#### Scenario: Validate news ingestion contract
- **WHEN** a news source, trigger, run, or enriched news endpoint changes
- **THEN** contract tests verify that the OpenAPI document and representative runtime response remain aligned
