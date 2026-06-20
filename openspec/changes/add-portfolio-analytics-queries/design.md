## Context

The service already reconstructs positions at a date, values them with
historical price and FX observations, groups several allocation dimensions, and
returns individual gain/loss inputs. It does not yet provide a portfolio-level
analytics formula, time series, asset concentration, or usable benchmark
history. Consuming agents would currently need to join these facts and choose
their own methodology, producing inconsistent answers.

The operation model classifies `contribution` and `withdrawal` as position
events. They can represent cash through a cash asset or in-kind flows through a
non-cash asset. A flow therefore needs effective-date valuation and can be
incomplete when operation value, historical price, or FX data is missing.

## Goals / Non-Goals

**Goals:**

- Provide deterministic point-in-time and sampled portfolio analytics.
- Separate external flows from mechanically derived gain or loss.
- Reuse one valuation and completeness model across analytics queries.
- Support asset allocation, top-N concentration, and normalized benchmark
  comparison with full provenance.
- Bound expensive historical calculations.

**Non-Goals:**

- Time-weighted return, money-weighted return, IRR, alpha, attribution, tax
  reporting, advice, or recommendation.
- Automatic market-data retrieval or benchmark-provider integration.
- Silent interpolation, forward-fill, or substitution of missing observations.
- Materialized analytics tables in the first implementation.

## Decisions

### Use a summary endpoint and a range endpoint

Add a point-in-time summary endpoint for one requested date and an evolution
endpoint with `from`, `to`, and `interval`. The summary endpoint is the canonical
calculation; evolution applies it to deterministic sample dates.

This avoids a single endpoint whose response shape changes substantially based
on optional range parameters. Extending only `/portfolio/value/{date}` was
considered, but that endpoint is position-oriented and would become overloaded
with portfolio-level methodology.

### Define gain or loss as a reconciliation equation

For the period from `reliableFrom` to the requested date:

`gainLoss = endingMarketValue - openingMarketValue - netExternalFlow`

`netExternalFlow = contributions - withdrawals`

All values are converted to portfolio base currency at their effective dates.
The API returns every component rather than only the result. If any required
component is unavailable, `gainLoss` is unavailable.

This is a transparent value bridge, not a named investment-return methodology.
Using current cost basis alone was rejected because it does not cleanly separate
external flows or explain portfolio evolution.

### Treat contribution and withdrawal as the only external flows

Buys and sells move value between cash and investments; dividends, yields,
redemptions, and maturities are portfolio results or internal transformations;
transfers and corporate actions do not change portfolio-wide external capital.
Only explicit contribution and withdrawal operations enter external-flow
totals.

An operation price provides the preferred effective-date flow valuation when it
represents the factual transferred value. Otherwise the historical valuation
selector is used and missing data is reported. No amount is inferred as zero.

### Store benchmark observations separately

Add immutable observations keyed by benchmark rather than treating every
benchmark as a portfolio asset. Benchmarks may be indexes that cannot be held,
and separate storage preserves that distinction. Selection uses explicit source
and stable tie-break rules. After the baseline, an observation must fall after
the previous sample and on or before the current sample so stale levels are not
silently carried across empty intervals.

### Compare normalized levels, not asserted returns

Portfolio and benchmark series are normalized to 100 at their first common
complete sample. Missing samples remain explicit gaps. This answers evolution
comparison without claiming TWR, MWR, alpha, or investability.

### Centralize completeness diagnostics

Introduce one internal diagnostic union and response envelope shared by valued
queries. Status is `complete`, `partial`, or `unavailable`. Percentages and
gain/loss are omitted when their denominator or required components are
incomplete; known subtotals may still be returned and clearly labeled.

### Bound historical computation

Support a small documented interval set such as daily, weekly, and monthly.
Validate maximum range and sample count before calculation. Compute from source
facts initially; materialization can be introduced later only with equivalence
tests against source calculation.

## Risks / Trade-offs

- [Historical analytics can be expensive] → Enforce range/sample limits and
  reuse calculation primitives before considering caches or materialization.
- [In-kind flows can lack effective-date value] → Return partial results with
  precise price/FX diagnostics; never substitute current data.
- [Current contribution semantics are broader than cash deposits] → Name output
  `externalFlow`, document classification, and test both cash and in-kind cases.
- [Normalized comparison may be mistaken for investment performance] → Use
  explicit `normalizedIndex` naming and document excluded methodologies.
- [Pending-work relevance can be ambiguous] → Include only pending items whose
  dates or records can affect the requested portfolio/date range, and test the
  filtering rules.

## Migration Plan

1. Add an additive benchmark-observation migration and indexes for deterministic
   date/source lookup.
2. Add domain types, validation, persistence, and ingestion/list endpoints.
3. Extract shared historical valuation and completeness helpers.
4. Add summary, evolution, asset-allocation, concentration, and comparison
   queries behind additive endpoints.
5. Extend OpenAPI and agent usage documentation.
6. Validate results against fixture calculations before deployment.

Rollback removes the additive endpoints from routing while retaining benchmark
observations. The schema migration remains harmless and can be removed later
only after confirming no observations were written.

## Open Questions

- Final endpoint names and default limits should be chosen during implementation
  alongside the existing route naming conventions.
- The first release should decide whether weekly samples end on Sunday or use a
  configurable market-week convention; the contract must make this explicit.
