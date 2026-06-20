## ADDED Requirements

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
