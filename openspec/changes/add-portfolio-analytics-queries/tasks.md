## 1. Calculation Contract And Fixtures

- [x] 1.1 Add regression fixtures covering opening value, cash and in-kind contributions, withdrawals, internal trades, income, corporate actions, and incomplete market data.
- [x] 1.2 Define exact base-currency flow valuation, gain-or-loss, sampling-date, stable-ordering, and rounding rules in shared calculation tests.
- [x] 1.3 Define supported intervals, weekly boundary convention, maximum range, maximum sample count, and top-N limits.

## 2. Benchmark Observation Model

- [x] 2.1 Add an additive migration and indexes for immutable historical benchmark observations.
- [x] 2.2 Add domain validation, store interfaces, in-memory persistence, and PostgreSQL persistence for benchmark observations.
- [x] 2.3 Implement deterministic observation selection by date and optional source with stable tie-breakers.
- [x] 2.4 Add benchmark observation ingestion and lookup endpoints with validation and persistence tests.

## 3. Shared Valuation And Completeness

- [x] 3.1 Extract reusable effective-date price, FX, benchmark, and base-currency conversion helpers without changing existing valuation results.
- [x] 3.2 Implement the shared `complete`, `partial`, and `unavailable` envelope with typed diagnostics and provenance.
- [x] 3.3 Filter pending-work and unresolved-data diagnostics to records relevant to the requested portfolio and date or range.
- [x] 3.4 Add tests proving missing data remains unavailable and is never replaced by current, future, or unrelated-source observations.

## 4. Point-In-Time Analytics

- [x] 4.1 Implement cumulative contribution, withdrawal, and net-external-flow calculation using only explicitly classified external-flow operations.
- [x] 4.2 Implement opening value and ending market value calculation in portfolio base currency with effective-date provenance.
- [x] 4.3 Implement mechanically derived gain or loss and suppress it when any required component is unavailable.
- [x] 4.4 Add the point-in-time analytics endpoint with validation, stable response ordering, and complete/partial fixtures.

## 5. Allocation And Concentration

- [x] 5.1 Extend valued allocation with stable asset-level grouping across brokerage accounts.
- [x] 5.2 Add base-currency value and whole-portfolio percentage fields without presenting percentages as complete when positions are unavailable.
- [x] 5.3 Implement configurable top-N concentration with deterministic tie ordering, cumulative weight, residual weight, and excluded-position diagnostics.
- [x] 5.4 Add tests for duplicated custody assets, equal-valued assets, missing valuations, empty portfolios, and top-N bounds.

## 6. Evolution And Benchmark Comparison

- [x] 6.1 Implement deterministic daily, weekly, and monthly sample-date generation with range and sample-count guards.
- [x] 6.2 Implement portfolio evolution by reusing the canonical point-in-time analytics calculation for every sample.
- [x] 6.3 Implement normalized portfolio-versus-benchmark index series with a common complete baseline and explicit gaps.
- [x] 6.4 Add tests for external flows between samples, missing opening value, benchmark gaps, explicit source selection, and reliability-boundary behavior.

## 7. API Contract And Agent Guidance

- [x] 7.1 Extend OpenAPI schemas and routes for benchmark observations, analytics summary, evolution, asset allocation, concentration, and benchmark comparison.
- [x] 7.2 Document formulas, classifications, provenance, sampling rules, limits, diagnostics, and excluded performance methodologies.
- [x] 7.3 Update agent usage guidance with examples for point-in-time analytics, evolution, concentration, benchmark comparison, and safe interpretation of partial results.
- [x] 7.4 Add contract tests proving every implemented analytics route and parameter remains aligned with OpenAPI.

## 8. Validation And Delivery

- [x] 8.1 Run targeted analytics, flow, valuation, benchmark, completeness, migration, and PostgreSQL persistence tests.
- [x] 8.2 Run the full test suite, typecheck, lint, build, and OpenSpec strict validation.
- [x] 8.3 Compare analytics fixture outputs against independently calculated expected value bridges and normalized benchmark series.
- [x] 8.4 Review the implementation boundary and confirm no advice, tax logic, attribution, TWR, MWR, IRR, alpha, or automatic market-data integration was introduced.
