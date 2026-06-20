## ADDED Requirements

### Requirement: Dated external statement
The system SHALL store an external portfolio statement with brokerage account, statement date, source, optional external statement identifier, and reported position lines.

#### Scenario: Record a statement
- **WHEN** a client submits a statement with valid account, date, source, and position lines
- **THEN** the system stores the statement and returns a stable statement identifier

#### Scenario: Preserve an unresolved statement asset
- **WHEN** a statement line cannot be mapped unambiguously to a known asset
- **THEN** the system stores the line as unresolved without assigning it to an arbitrary asset

### Requirement: Position reconciliation
The system SHALL compare a stored statement with positions calculated for the same brokerage account and statement date.

#### Scenario: Reconcile matching position
- **WHEN** reported and calculated quantities for an asset are equal
- **THEN** the reconciliation marks the position as matched and reports a zero quantity difference

#### Scenario: Reconcile quantity discrepancy
- **WHEN** reported and calculated quantities for an asset differ
- **THEN** the reconciliation reports both quantities, their signed difference, and a discrepancy status

#### Scenario: Report position present on one side only
- **WHEN** an asset exists only in the statement or only in the calculated ledger
- **THEN** the reconciliation returns the asset as an unmatched position and identifies the missing side

### Requirement: Reconciliation cost and value comparison
The system SHALL compare reported cost or market value when those fields are supplied and SHALL distinguish unavailable data from a zero difference.

#### Scenario: Compare reported cost
- **WHEN** a statement provides cost and the calculated position has a known cost basis in the same or convertible currency
- **THEN** the reconciliation reports reported cost, calculated cost, conversion provenance when used, and the difference

#### Scenario: Cost comparison is unavailable
- **WHEN** either side lacks sufficient cost or exchange-rate data
- **THEN** the reconciliation marks the cost comparison unavailable and identifies the missing input

### Requirement: Non-mutating reconciliation
The system SHALL preserve the statement, ledger inputs, calculated result, creation timestamp, and status of a reconciliation without automatically changing operations or opening balances.

#### Scenario: Complete reconciliation with discrepancies
- **WHEN** a reconciliation detects one or more discrepancies
- **THEN** the system stores the result for later review and leaves all portfolio ledger records unchanged

### Requirement: Reconciliation history
The system SHALL allow clients to retrieve reconciliation runs and their results by account and date using stable ordering.

#### Scenario: List account reconciliations
- **WHEN** a client requests reconciliation history for a brokerage account
- **THEN** the system returns runs ordered by statement date and creation time with stable tie-breakers
