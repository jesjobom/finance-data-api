## ADDED Requirements

### Requirement: News classification submission API
The system SHALL document an authenticated versioned endpoint for agents to
create idempotent classifications for an existing news item with explicit
provenance, dimensions, targets, evidence, and optional supersession.

#### Scenario: Submit classification through API
- **WHEN** an authenticated agent posts a valid classification to a news item
- **THEN** the API returns the documented classification resource and indicates whether it was created or replayed

#### Scenario: Return classification conflict
- **WHEN** an idempotency identity is reused with different canonical content
- **THEN** the API returns a documented structured conflict response without changing stored history

### Requirement: News classification retrieval API
The system SHALL document authenticated versioned endpoints to retrieve one
classification, list a news item's classification history, and query
classifications using bounded filters and pagination.

#### Scenario: Retrieve current classifications
- **WHEN** a client requests current classifications for one news item
- **THEN** the API returns every non-superseded classifier lineage in deterministic order

#### Scenario: Filter classifications
- **WHEN** a client supplies supported importance, geography, currency, sector, target, direction, confidence, review, or publication filters
- **THEN** the API validates the filters and returns a documented bounded response

### Requirement: News classification review API
The system SHALL document an authenticated versioned endpoint to append a review
decision and SHALL expose review history and effective review state.

#### Scenario: Append review through API
- **WHEN** an authenticated reviewer submits a valid decision and actor identity
- **THEN** the API returns the new review and the classification's effective review state

### Requirement: News classification queue API
The system SHALL document authenticated versioned endpoints for unclassified
news, unreviewed current classifications, and classifications needing revision.

#### Scenario: Retrieve classifier work
- **WHEN** an agent requests an unclassified-news page
- **THEN** the response uses an explicit schema, stable ordering, and documented page bounds

### Requirement: News classification OpenAPI schemas
The checked-in OpenAPI document SHALL define explicit reusable request and
response schemas for classifications, dimensions, evidence, impact targets,
resolutions, reviews, idempotent results, filtered pages, and queue entries.

#### Scenario: Validate classification API contract
- **WHEN** a classification route, validation rule, or response shape changes
- **THEN** contract tests verify runtime and OpenAPI alignment and reject empty or unresolved schemas
