# api-contract Specification

## Purpose
TBD - created by archiving change add-finance-data-api-mvp1. Update Purpose after archive.
## Requirements
### Requirement: REST API contract
The system SHALL expose MVP1 functionality through a versioned REST API.

#### Scenario: Call versioned endpoint
- **WHEN** a client calls an MVP1 endpoint
- **THEN** the endpoint path includes an API version segment and returns a documented response shape

### Requirement: OpenAPI documentation
The system SHALL include checked-in OpenAPI documentation for all MVP1 endpoints, request bodies, response bodies, and error responses.

#### Scenario: Validate documented endpoint
- **WHEN** an endpoint is added or changed
- **THEN** the OpenAPI document is updated in the same change and can be used for contract validation

### Requirement: Token authentication
The system SHALL require bearer-token authentication for non-healthcheck MVP1 endpoints.

#### Scenario: Reject missing token
- **WHEN** a client calls a protected endpoint without a bearer token
- **THEN** the system rejects the request with an authentication error

### Requirement: Validation errors
The system SHALL return structured validation errors for invalid client input.

#### Scenario: Invalid create request
- **WHEN** a client submits a request missing required fields
- **THEN** the system returns a structured validation error identifying the invalid fields

### Requirement: Deterministic response ordering
The system SHALL define stable ordering for list and query responses.

#### Scenario: List operations
- **WHEN** a client requests a list of operations
- **THEN** the system returns items ordered by effective date and stable tie-breaker fields documented in the API contract

### Requirement: Healthcheck
The system SHALL provide an unauthenticated healthcheck endpoint that reports service readiness without exposing sensitive data.

#### Scenario: Call healthcheck
- **WHEN** a client calls the healthcheck endpoint
- **THEN** the system returns service status without requiring authentication

### Requirement: Accounting foundation API documentation
The system SHALL document portfolio configuration, brokerage accounts, opening
state, asset identity, transfers, corporate actions, operation revisions,
imports, prices, exchange rates, statements, reconciliations, valued query
responses, analytics, benchmarks, and processing results in the checked-in
OpenAPI contract, including explicit request and successful response schemas.

#### Scenario: Change an accounting endpoint
- **WHEN** an accounting or analytics endpoint, request schema, or runtime response shape changes
- **THEN** the OpenAPI document changes in the same implementation and contract validation covers the new behavior

### Requirement: Idempotent import response semantics
The system SHALL document whether an operation import created a new operation or returned an existing operation from an idempotent replay.

#### Scenario: Return replay result
- **WHEN** an identical import is replayed
- **THEN** the API response identifies the existing operation and indicates that no new resource was created

### Requirement: Import conflict response
The system SHALL return a structured conflict response when an import identity is reused with different factual content.

#### Scenario: Return import conflict details
- **WHEN** a source/account/external-ID tuple already exists with a different canonical payload
- **THEN** the API returns a conflict code identifying the idempotency scope without exposing sensitive unrelated records

### Requirement: Market-data provenance contract
The system SHALL include observation identifiers, effective dates, currencies, sources, selection policy, and missing-data diagnostics in valuation responses.

#### Scenario: Document unavailable conversion
- **WHEN** valuation cannot convert an amount because historical FX data is missing
- **THEN** the response conforms to a documented structured missing-market-data schema

### Requirement: Revision concurrency
The system SHALL prevent silent loss of concurrent operation corrections using a documented conditional update or version check.

#### Scenario: Reject stale operation revision
- **WHEN** a client revises an operation using an outdated version or update timestamp
- **THEN** the API rejects the stale update and preserves the newer operation and its revision history

### Requirement: Portfolio analytics API contract
The system SHALL document point-in-time analytics, evolution, concentration,
asset allocation, benchmark observations, and benchmark comparison in the
checked-in OpenAPI contract.

#### Scenario: Change an analytics formula or response
- **WHEN** an analytics endpoint, formula, parameter, diagnostic, or response schema changes
- **THEN** the OpenAPI document changes in the same implementation and contract tests cover the behavior

### Requirement: Analytics formula documentation
The system SHALL document external-flow classification, base-currency
conversion, gain-or-loss formulas, sampling dates, benchmark normalization,
stable ordering, range limits, and incomplete-result semantics.

#### Scenario: Consume analytics without inferred methodology
- **WHEN** an agent reads the OpenAPI contract and agent usage guide
- **THEN** it can determine how every returned component was calculated and which claims the API intentionally does not make

### Requirement: Analytics query validation
The system SHALL validate dates, ranges, intervals, top-N limits, benchmark
identifiers, source selectors, and portfolio identifiers with structured errors.

#### Scenario: Reject invalid date range
- **WHEN** `from` is after `to` or a date precedes the portfolio reliability boundary without an explicitly supported partial response
- **THEN** the API returns a structured validation response containing the invalid parameters and reliability boundary

### Requirement: Explicit successful response schemas
Every public API operation with a successful response SHALL document a
non-empty response schema that describes the runtime JSON shape, including
arrays, objects, nullable results, required identity fields, and optional fields.

#### Scenario: Validate response schema coverage
- **WHEN** the OpenAPI contract test inspects every public operation and successful status code
- **THEN** each JSON response contains a non-empty inline schema or a valid component reference

### Requirement: Reusable response components
The system SHALL define reusable response components for shared resources and
value objects rather than duplicating divergent inline schemas.

#### Scenario: Reuse a resource shape
- **WHEN** list, create, get, and update operations return the same resource type
- **THEN** their response schemas reference the same canonical component or array item component

### Requirement: Runtime-compatible optionality
Response schemas SHALL distinguish required, optional, nullable, partial, and
unavailable fields according to actual runtime behavior.

#### Scenario: Document unavailable valuation
- **WHEN** a valuation can omit `baseValue` and return missing-data diagnostics
- **THEN** the response schema does not require `baseValue` and explicitly permits the unavailable shape

### Requirement: Valid response references
Every response schema reference SHALL resolve to a declared OpenAPI component,
and contract validation SHALL fail on dangling references.

#### Scenario: Detect unknown response component
- **WHEN** a response references an undeclared component
- **THEN** the contract test fails before delivery

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

