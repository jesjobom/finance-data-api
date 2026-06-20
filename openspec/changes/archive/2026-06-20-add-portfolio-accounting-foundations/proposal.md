## Why

The current MVP can reconstruct simple positions, but it cannot safely represent an already-existing portfolio, reconcile calculated holdings with brokerage statements, or measure value and performance across currencies. These accounting foundations are required before the finance agent can treat the API as a trustworthy portfolio ledger.

## What Changes

- Add explicit portfolio configuration with a base currency and a `reliableFrom` date that states when calculated history becomes trustworthy.
- Add opening positions and cash balances so an existing portfolio can start from a declared baseline without inventing unknown transactions.
- Add deterministic reconciliation against a dated external statement, including matched positions, discrepancies, and unmatched assets.
- Add brokerage-account or custody context and operation support for transfers, splits, reverse splits, and stock bonuses while preserving quantity and cost basis.
- Require stable asset identity using normalized `market + symbol`; keep ISIN optional.
- Add historical asset prices and foreign-exchange rates with effective date, currency or currency pair, source, and audit timestamps.
- Return original-currency values and deterministic base-currency conversions using identifiable historical rates.
- Add correction metadata to revised operations, including `createdAt`, `updatedAt`, and a required revision reason when factual fields change.
- Add idempotent operation import using an external operation identifier scoped by import source and brokerage account.

## Capabilities

### New Capabilities

- `portfolio-reconciliation`: Dated statement ingestion and deterministic comparison of reported positions with positions calculated by the API.
- `market-data-valuation`: Historical prices, foreign-exchange rates, original-currency values, base-currency conversion, and valuation provenance.

### Modified Capabilities

- `financial-records`: Add portfolio/account configuration, opening balances, stable asset identity, custody-aware operations, basic corporate actions, correction audit metadata, and import idempotency.
- `deterministic-queries`: Expose history reliability and calculate quantities, cost, value, and performance consistently across opening balances, transfers, corporate actions, prices, and exchange rates.
- `api-contract`: Document idempotent import behavior, reconciliation resources, valuation provenance, conflict semantics, and the new record fields.

## Impact

- Requires additive PostgreSQL migrations and backfill rules for existing investments and operations.
- Changes domain types, validation, persistence, portfolio calculation, historical queries, and OpenAPI schemas.
- Adds API resources for portfolio configuration, opening balances, market data, imports, and reconciliations.
- Existing clients may continue using internal operation IDs, but imported operations need source/account-scoped external IDs to receive idempotency guarantees.
- No brokerage integration or automatic market-data provider is added; the API stores and deterministically consumes data supplied by clients.
