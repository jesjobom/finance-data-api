## ADDED Requirements

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
