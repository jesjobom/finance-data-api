## ADDED Requirements

### Requirement: Basic lookup queries
The system SHALL provide deterministic lookup queries for investments, operations, news, watched assets, virtual portfolios, benchmarks, and snapshots by identifier and relevant filters.

#### Scenario: List operations by investment
- **WHEN** a client requests operations for a specific investment
- **THEN** the system returns only operations linked to that investment using stable ordering by operation date and creation time

### Requirement: Current portfolio query
The system SHALL provide a current portfolio query that consolidates active positions from operation records and excludes closed historical positions from active holdings.

#### Scenario: Get current portfolio
- **WHEN** a client requests the current portfolio
- **THEN** the system returns consolidated positions with quantities and source investment metadata

### Requirement: Historical portfolio query
The system SHALL provide a portfolio-at-date query that reconstructs holdings as of a requested date using operation history and available snapshots.

#### Scenario: Get portfolio at date
- **WHEN** a client requests portfolio state for a past date
- **THEN** the system returns positions calculated from records effective on or before that date

### Requirement: Allocation queries
The system SHALL provide allocation queries by asset class, currency, country or market, and broker or custodian.

#### Scenario: Get allocation by currency
- **WHEN** a client requests allocation by currency
- **THEN** the system groups portfolio positions by currency without generating investment advice

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
