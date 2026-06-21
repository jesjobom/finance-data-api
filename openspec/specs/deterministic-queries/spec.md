# deterministic-queries Specification

## Purpose
TBD - created by archiving change add-finance-data-api-mvp1. Update Purpose after archive.
## Requirements
### Requirement: Basic lookup queries
The system SHALL provide deterministic lookup queries for investments, operations, news, watched assets, virtual portfolios, benchmarks, and snapshots by identifier and relevant filters.

#### Scenario: List operations by investment
- **WHEN** a client requests operations for a specific investment
- **THEN** the system returns only operations linked to that investment using stable ordering by operation date and creation time

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

### Requirement: News queries
The system SHALL provide news queries by day, period, related portfolio asset, related watched asset, and unprocessed status.

#### Scenario: Get news for current portfolio assets
- **WHEN** a client requests news for assets currently held in the real portfolio
- **THEN** the system returns news linked to those held assets

### Requirement: Daily raw data package
The system SHALL provide a daily raw data package containing current portfolio, news for the requested day, recent operations, and pending processing items.

#### Scenario: Get daily package
- **WHEN** the finance agent requests the daily raw package for a date
- **THEN** the system returns factual portfolio, news, operation, and pending-state data without recommendation or scoring fields

### Requirement: Change detection query
The system SHALL provide a query for changes since a previous cursor or timestamp across investments, operations, news, snapshots, and processing states.

#### Scenario: Get changes since cursor
- **WHEN** a client requests changes since a valid cursor
- **THEN** the system returns changed records and a new cursor for the next request

### Requirement: Real versus virtual comparison
The system SHALL provide a deterministic comparison between real holdings and a selected virtual portfolio by asset and raw position data.

#### Scenario: Compare real and virtual portfolio
- **WHEN** a client requests comparison with a virtual portfolio
- **THEN** the system returns position differences and raw performance inputs without recommending changes

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

### Requirement: Reusable query completeness metadata
The system SHALL use consistent completeness statuses and diagnostic shapes
across historical valuation, valued allocation, portfolio analytics, evolution,
concentration, and benchmark-comparison queries.

#### Scenario: Identify missing valuation dependency consistently
- **WHEN** the same missing price or FX observation affects multiple query types
- **THEN** each response uses the same diagnostic type, affected identity, requested date, and source criteria

