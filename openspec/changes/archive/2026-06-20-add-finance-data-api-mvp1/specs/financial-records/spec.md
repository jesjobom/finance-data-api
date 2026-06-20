## ADDED Requirements

### Requirement: Investment records
The system SHALL store investment records with stable identifiers, ticker or symbol, display name, asset class, currency, market or country when known, broker or custodian when known, active status, and audit timestamps.

#### Scenario: Create an investment
- **WHEN** a client submits a valid investment record
- **THEN** the system persists the investment and returns its stable identifier and stored fields

#### Scenario: Deactivate an investment
- **WHEN** a client deactivates an existing investment
- **THEN** the system marks it inactive without deleting historical operations or snapshots

### Requirement: Operation records
The system SHALL store operations linked to investments using explicit operation types including buy, sell, contribution, withdrawal, dividend, yield, redemption, and maturity.

#### Scenario: Record a buy operation
- **WHEN** a client submits a buy operation with investment, date, quantity, price, currency, and fees when applicable
- **THEN** the system stores the operation and includes it in future deterministic portfolio calculations

#### Scenario: Reject unknown operation type
- **WHEN** a client submits an operation with an unsupported type
- **THEN** the system rejects the request with a validation error and does not persist the operation

### Requirement: News records
The system SHALL store news items with source, URL when available, title, summary or body, published timestamp, related assets, and audit timestamps.

#### Scenario: Create news linked to assets
- **WHEN** a client submits a news item referencing one or more known assets
- **THEN** the system stores the news item and links it to those assets

#### Scenario: Store news without intelligence
- **WHEN** a news item is created
- **THEN** the system stores factual fields only and does not assign recommendation, impact score, sentiment score, or thesis status

### Requirement: Watchlist assets
The system SHALL store watched assets that do not require a real portfolio position.

#### Scenario: Add watched asset
- **WHEN** a client adds an asset to the watchlist
- **THEN** the system stores it separately from real portfolio holdings and includes it in watchlist queries

### Requirement: Virtual portfolios
The system SHALL store virtual portfolios and virtual positions independently from the real portfolio.

#### Scenario: Create virtual position
- **WHEN** a client creates a virtual position for an asset in a virtual portfolio
- **THEN** the system stores the virtual position without changing real holdings

### Requirement: Benchmarks
The system SHALL store benchmark definitions that can be referenced by portfolio comparison queries.

#### Scenario: Register benchmark
- **WHEN** a client registers a benchmark with name, symbol or identifier, currency, and source metadata
- **THEN** the system stores the benchmark and makes it available for lookup

### Requirement: Portfolio snapshots
The system SHALL store portfolio snapshots with snapshot timestamp, source metadata, and position data sufficient to reconstruct the stored state.

#### Scenario: Record snapshot
- **WHEN** a client records a portfolio snapshot
- **THEN** the system stores the snapshot and associates it with the captured positions
