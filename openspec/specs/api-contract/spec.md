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
The system SHALL document portfolio configuration, brokerage accounts, opening state, asset identity, transfers, corporate actions, operation revisions, imports, prices, exchange rates, statements, reconciliations, and valued query responses in the checked-in OpenAPI contract.

#### Scenario: Change an accounting endpoint
- **WHEN** an accounting foundation endpoint or schema changes
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

