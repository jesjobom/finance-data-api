# financial-records Specification

## Purpose
TBD - created by archiving change add-finance-data-api-mvp1. Update Purpose after archive.
## Requirements
### Requirement: Investment records
The system SHALL store assets with stable identifiers, normalized market and symbol, display name, asset class, currency, optional ISIN, active status, and audit timestamps independently from brokerage or custody accounts.

#### Scenario: Create an investment
- **WHEN** a client submits a valid asset with market, symbol, display name, asset class, and currency
- **THEN** the system persists the asset and returns its stable identifier and stored fields

#### Scenario: Reject duplicate market and symbol
- **WHEN** a client submits an active asset whose normalized market and symbol already identify an existing asset
- **THEN** the system rejects the duplicate or returns the existing asset according to the documented create semantics

#### Scenario: Deactivate an investment
- **WHEN** a client deactivates an existing asset
- **THEN** the system marks it inactive without deleting historical operations, custody positions, statements, prices, or snapshots

### Requirement: Operation records
The system SHALL store custody-aware operations linked to assets and brokerage accounts using explicit operation types including buy, sell, contribution, withdrawal, dividend, yield, redemption, maturity, transfer, split, reverse split, and bonus.

#### Scenario: Record a buy operation
- **WHEN** a client submits a buy operation with asset, brokerage account, date, quantity, price, currency, and fees when applicable
- **THEN** the system stores the operation and includes it in future deterministic portfolio calculations

#### Scenario: Reject unknown operation type
- **WHEN** a client submits an operation with an unsupported type
- **THEN** the system rejects the request with a validation error and does not persist the operation

#### Scenario: Require operation-specific fields
- **WHEN** a client submits a transfer or corporate action without the fields required for that operation type
- **THEN** the system rejects the operation and identifies the missing fields

### Requirement: News records
The system SHALL store news items with stable source identity, source-provided
external identifier when available, original and canonical URLs, title,
summary, optional full article body, published and retrieved timestamps,
language, region, topic metadata, raw content hash, duplicate-group metadata,
related assets, processing state, and audit timestamps.

#### Scenario: Create news linked to assets
- **WHEN** a client submits a news item referencing one or more known assets
- **THEN** the system stores the news item and links it to those assets

#### Scenario: Store collected source provenance
- **WHEN** a source adapter persists a normalized news candidate
- **THEN** the stored item identifies the registered source and retains its ingestion identity and retrieval provenance

#### Scenario: Store full internal-use content
- **WHEN** the collector obtains a full article body from an enabled source
- **THEN** the system stores the body with the news item without requiring a metadata-only restriction

#### Scenario: Store news without intelligence
- **WHEN** a news item is created or enriched
- **THEN** the system stores factual source content and metadata only and does not assign recommendation, impact score, sentiment score, or thesis status

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

### Requirement: Portfolio and brokerage accounts
The system SHALL represent a portfolio separately from one or more brokerage or custody accounts and SHALL assign each operation or opening position to the applicable account.

#### Scenario: Register two accounts holding the same asset
- **WHEN** the same asset is held at two brokerage accounts
- **THEN** the system uses one asset identity and reports separate custody quantities by account

### Requirement: Explicit opening state
The system SHALL allow a portfolio to declare a `reliableFrom` date and record opening positions or cash balances effective on that date without inventing earlier operations.

#### Scenario: Open an existing position with known cost
- **WHEN** a client records an opening position with account, asset, quantity, original currency, and total cost
- **THEN** calculations from `reliableFrom` include the supplied quantity and cost without creating a synthetic buy

#### Scenario: Open an existing position with unknown cost
- **WHEN** a client records an opening position whose cost basis is unknown
- **THEN** the system preserves the unknown cost state and does not treat the cost as zero

#### Scenario: Query before reliable history
- **WHEN** a client requests calculated portfolio history before `reliableFrom`
- **THEN** the system rejects the calculation or marks the result unreliable with the configured boundary

### Requirement: Custody transfer
The system SHALL record a transfer between brokerage accounts as one logical event that preserves portfolio-wide asset quantity and cost basis.

#### Scenario: Transfer full position
- **WHEN** a valid transfer moves an entire asset position between two accounts
- **THEN** the source quantity decreases, destination quantity increases by the same amount, and portfolio-wide quantity and total cost basis remain unchanged

#### Scenario: Reject unbalanced transfer
- **WHEN** a transfer has the same source and destination, insufficient source quantity, or unequal transfer legs
- **THEN** the system rejects the complete transfer without applying either custody leg

### Requirement: Split and reverse split
The system SHALL apply a positive split ratio to eligible positions while preserving total cost basis and changing quantity and unit cost proportionally.

#### Scenario: Apply two-for-one split
- **WHEN** a two-for-one split is effective for a position
- **THEN** calculated quantity doubles, total cost basis is preserved, and unit cost is halved

#### Scenario: Apply reverse split
- **WHEN** a valid reverse-split ratio is effective for a position
- **THEN** calculated quantity decreases according to the ratio and total cost basis is preserved, subject to explicitly recorded fractional handling

### Requirement: Stock bonus
The system SHALL record bonus quantity and its explicit cost-basis treatment without representing the event as a cash purchase.

#### Scenario: Apply bonus with assigned cost
- **WHEN** a bonus event supplies additional quantity and assigned total cost
- **THEN** the system increases quantity and cost basis by the supplied amounts without recording a purchase cash flow

#### Scenario: Apply zero-cost bonus
- **WHEN** a bonus event explicitly declares zero assigned cost
- **THEN** the system increases quantity while preserving the prior total cost basis

### Requirement: Operation correction audit
The system SHALL maintain `createdAt` and `updatedAt` for operations and SHALL require a non-empty reason when factual operation data is revised.

#### Scenario: Revise factual operation data
- **WHEN** a client changes an operation quantity, price, date, asset, account, type, currency, fees, or other factual accounting field
- **THEN** the system atomically updates the operation and appends an immutable revision containing before values, after values, actor, reason, and timestamp

#### Scenario: Reject revision without reason
- **WHEN** a client attempts to change factual operation data without a non-empty revision reason
- **THEN** the system rejects the update and leaves the operation unchanged

### Requirement: Idempotent operation import
The system SHALL accept an external operation identifier scoped by import source and brokerage account and SHALL prevent duplicate operations for that scope.

#### Scenario: Replay identical imported operation
- **WHEN** a client imports the same canonical factual payload with the same source, account, and external identifier more than once
- **THEN** the system returns the existing operation and creates no duplicate

#### Scenario: Reuse import identifier with different facts
- **WHEN** a client reuses the same source, account, and external identifier with a different canonical factual payload
- **THEN** the system returns a conflict and leaves the existing operation unchanged

#### Scenario: Reuse external identifier in another scope
- **WHEN** two different import sources or brokerage accounts use the same external identifier
- **THEN** the system treats the identifiers as distinct idempotency scopes

