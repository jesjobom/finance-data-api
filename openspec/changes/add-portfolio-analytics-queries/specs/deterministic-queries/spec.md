## MODIFIED Requirements

### Requirement: Allocation queries
The system SHALL provide allocation queries by asset, asset class, original
currency, base-currency value, country or market, and brokerage account or
custodian.

#### Scenario: Get allocation by original currency
- **WHEN** a client requests allocation by currency without valuation
- **THEN** the system groups portfolio positions by their original currencies without combining unlike monetary amounts

#### Scenario: Get valued allocation in base currency
- **WHEN** a client requests allocation by base-currency value and all required market data is available
- **THEN** the system converts values using selected historical observations and returns the source identifiers and effective dates used

#### Scenario: Get valued allocation by asset
- **WHEN** a client requests asset allocation for a historical date
- **THEN** the system groups custody positions by stable asset identity and returns base-currency value and whole-portfolio weight for each asset

## ADDED Requirements

### Requirement: Reusable query completeness metadata
The system SHALL use consistent completeness statuses and diagnostic shapes
across historical valuation, valued allocation, portfolio analytics, evolution,
concentration, and benchmark-comparison queries.

#### Scenario: Identify missing valuation dependency consistently
- **WHEN** the same missing price or FX observation affects multiple query types
- **THEN** each response uses the same diagnostic type, affected identity, requested date, and source criteria
