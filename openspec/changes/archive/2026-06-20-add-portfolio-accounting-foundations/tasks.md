## 1. Migration Safety And Accounting Fixtures

- [x] 1.1 Capture current portfolio-query behavior in regression fixtures before changing the persistence model.
- [x] 1.2 Define migration invariants for asset deduplication, default portfolio/account backfill, position equality, and legacy operation compatibility.
- [x] 1.3 Add database migration tests covering forward migration, collision reporting, and preservation of existing records.

## 2. Portfolio, Asset, And Custody Model

- [x] 2.1 Add migrations for portfolios, normalized assets, brokerage accounts, and legacy investment-to-asset/account mappings.
- [x] 2.2 Enforce normalized active asset identity uniqueness by market and symbol while keeping ISIN optional.
- [x] 2.3 Backfill the default portfolio, brokerage accounts, assets, and operation links from existing investment records.
- [x] 2.4 Add domain schemas, repositories, and tests for portfolio configuration, assets, brokerage accounts, and compatibility lookup.
- [x] 2.5 Implement portfolio, asset, and brokerage-account API endpoints with validation and stable ordering.

## 3. Opening State And Reliability Boundary

- [x] 3.1 Add migrations and domain models for dated opening positions and cash balances with known or explicitly unknown cost basis.
- [x] 3.2 Implement opening-state write and lookup endpoints anchored to portfolio `reliableFrom`.
- [x] 3.3 Update current and historical calculations to begin with opening state and apply only subsequent effective records.
- [x] 3.4 Add structured behavior and tests for queries before `reliableFrom` and for mixed known/unknown cost basis.

## 4. Transfers And Corporate Actions

- [x] 4.1 Add persistence and validation for atomic brokerage-account transfers with balanced source and destination custody legs.
- [x] 4.2 Implement transfer calculation behavior that preserves portfolio-wide quantity, cost basis, and realized gain.
- [x] 4.3 Add persistence and validation for split, reverse-split, and bonus events, including ratios, fractional handling, and explicit bonus cost treatment.
- [x] 4.4 Implement effective-date-ordered corporate-action calculations for quantity, total cost, and unit cost.
- [x] 4.5 Add fixture-based tests for partial/full transfers, split followed by transfer, reverse split, zero-cost bonus, assigned-cost bonus, and invalid events.

## 5. Correction Audit And Idempotent Imports

- [x] 5.1 Add immutable operation revision storage with before/after facts, actor, reason, timestamp, and operation version.
- [x] 5.2 Implement conditional factual operation updates that require a reason and atomically append a revision.
- [x] 5.3 Add source/account-scoped external import identity and canonical factual-payload hashing.
- [x] 5.4 Implement import responses for new creation, identical replay, and conflicting reuse without duplicate writes.
- [x] 5.5 Add concurrency, revision-history, replay, conflict, and cross-scope idempotency tests.

## 6. Historical Prices, FX, And Valuation

- [x] 6.1 Add migrations and repositories for immutable asset-price and FX-rate observations with effective time, currency data, source, and audit timestamps.
- [x] 6.2 Implement validated price and exchange-rate ingestion and historical lookup endpoints.
- [x] 6.3 Define and implement deterministic observation selection by explicit source or configured source priority.
- [x] 6.4 Implement same-currency, direct-rate, and labeled inverse-rate valuation while preserving original monetary values.
- [x] 6.5 Return price/FX provenance and structured missing-market-data diagnostics in valued portfolio and allocation queries.
- [x] 6.6 Add valuation tests for historical dates, source selection, base-currency changes, inverse rates, missing data, and unknown cost.

## 7. Statements And Reconciliation

- [x] 7.1 Add migrations and domain models for external statements, statement lines, asset mappings, reconciliation runs, and reconciliation results.
- [x] 7.2 Implement idempotent statement creation and preserve unresolved or ambiguous asset lines.
- [x] 7.3 Implement dated account reconciliation for matched, discrepant, statement-only, and ledger-only positions.
- [x] 7.4 Add optional cost and market-value comparisons with currency-conversion provenance and unavailable-data states.
- [x] 7.5 Implement reconciliation history and detail endpoints without mutating ledger records.
- [x] 7.6 Add reconciliation tests for exact matches, quantity differences, unresolved assets, one-sided positions, missing cost/FX data, and repeated runs.

## 8. API Contract And Agent Documentation

- [x] 8.1 Extend OpenAPI schemas and endpoints for portfolio configuration, assets, accounts, opening state, events, revisions, imports, market data, valuation, statements, and reconciliation.
- [x] 8.2 Document idempotent replay, import conflict, stale revision, reliability, and missing-market-data response semantics.
- [x] 8.3 Update agent usage documentation with examples for initializing an existing portfolio, importing statements safely, valuing a date, and reconciling an account.
- [x] 8.4 Add contract tests proving implemented routes and response schemas remain aligned with OpenAPI.

## 9. Validation And Delivery

- [x] 9.1 Run targeted accounting, migration, import, valuation, and reconciliation tests.
- [x] 9.2 Run the full test suite, typecheck, lint, build, and OpenSpec strict validation.
- [x] 9.3 Compare migrated current positions with the pre-change regression fixtures and document any intentional differences.
- [x] 9.4 Review the implementation boundary and confirm no tax advice, recommendation logic, automatic brokerage integration, or unsupported performance methodology was introduced.
