## ADDED Requirements

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
