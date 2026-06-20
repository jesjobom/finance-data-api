## MODIFIED Requirements

### Requirement: Current portfolio query
The system SHALL provide a current portfolio query that consolidates opening state and subsequent operations, reports positions by brokerage account and portfolio total, and excludes closed historical positions from active holdings.

#### Scenario: Get current portfolio
- **WHEN** a client requests the current portfolio
- **THEN** the system returns consolidated positions with quantities, known cost basis, asset identity, custody account, base currency, and history reliability metadata

#### Scenario: Consolidate transferred position
- **WHEN** an asset has been transferred between brokerage accounts
- **THEN** the query reports the destination custody quantity and unchanged portfolio-wide quantity and cost basis

### Requirement: Historical portfolio query
The system SHALL provide a portfolio-at-date query that reconstructs holdings from the explicit opening state and operations effective from `reliableFrom` through the requested date, using snapshots only as validated optimization or audit inputs.

#### Scenario: Get portfolio at reliable date
- **WHEN** a client requests portfolio state on or after `reliableFrom`
- **THEN** the system returns positions calculated from opening state and records effective on or before that date

#### Scenario: Request portfolio before reliability boundary
- **WHEN** a client requests portfolio state before `reliableFrom`
- **THEN** the system does not present the reconstructed state as reliable and returns the configured reliability boundary

### Requirement: Allocation queries
The system SHALL provide allocation queries by asset class, original currency, base-currency value, country or market, and brokerage account or custodian.

#### Scenario: Get allocation by original currency
- **WHEN** a client requests allocation by currency without valuation
- **THEN** the system groups portfolio positions by their original currencies without combining unlike monetary amounts

#### Scenario: Get valued allocation in base currency
- **WHEN** a client requests allocation by base-currency value and all required market data is available
- **THEN** the system converts values using selected historical observations and returns the source identifiers and effective dates used

## ADDED Requirements

### Requirement: Corporate-action-aware calculation
The system SHALL apply transfers, splits, reverse splits, and bonuses in effective-date order with stable tie-breakers when calculating quantity and cost basis.

#### Scenario: Calculate position after split and transfer
- **WHEN** a position receives a split and is later transferred to another account
- **THEN** the query applies the split first, transfers the adjusted quantity and cost, and preserves the portfolio-wide totals

### Requirement: History reliability metadata
The system SHALL include the portfolio `reliableFrom` date and a reliability status in current, historical, valuation, performance-input, and reconciliation query responses.

#### Scenario: Return reliable result
- **WHEN** all calculation inputs fall on or after `reliableFrom`
- **THEN** the query labels the result reliable and returns the boundary date

### Requirement: Deterministic cost availability
The system SHALL distinguish known, partially known, and unknown cost basis in portfolio calculations.

#### Scenario: Aggregate mixed known and unknown opening cost
- **WHEN** a consolidated position contains units with unknown cost basis
- **THEN** the query does not present an incomplete aggregate cost or gain as fully known and identifies the unavailable portion
