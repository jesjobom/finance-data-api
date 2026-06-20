## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Accounting foundation API documentation
The system SHALL document portfolio configuration, brokerage accounts, opening
state, asset identity, transfers, corporate actions, operation revisions,
imports, prices, exchange rates, statements, reconciliations, valued query
responses, analytics, benchmarks, and processing results in the checked-in
OpenAPI contract, including explicit request and successful response schemas.

#### Scenario: Change an accounting endpoint
- **WHEN** an accounting or analytics endpoint, request schema, or runtime response shape changes
- **THEN** the OpenAPI document changes in the same implementation and contract validation covers the new behavior
