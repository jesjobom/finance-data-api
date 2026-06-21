## Why

The API exposes point-in-time positions and valuation inputs, but a consuming
finance agent still has to combine several endpoints and invent calculation
rules to answer common portfolio questions. The service should provide one
deterministic analytics contract that separates external cash flow from market
gain or loss and makes incomplete results explicit.

## What Changes

- Add a point-in-time portfolio analytics query with total market value,
  cumulative contributions, cumulative withdrawals, net external flow, and
  mechanically derived gain or loss.
- Add portfolio evolution over a bounded date range using an explicit sampling
  interval and deterministic end-of-period observations.
- Extend valued allocation to include asset-level grouping and return allocation
  percentages as well as base-currency values.
- Add concentration output for the largest assets, including top-N weight and
  residual portfolio weight.
- Add immutable historical benchmark observations and compare portfolio and
  benchmark evolution as normalized index series.
- Add a common completeness envelope that identifies reliability boundaries,
  unknown cost basis, missing prices, missing FX rates, missing benchmark
  observations, and pending factual processing.
- Keep all outputs factual and mechanically derived. This change does not add
  recommendations, performance attribution, tax calculations, or unsupported
  time-weighted or money-weighted return claims.

## Capabilities

### New Capabilities

- `portfolio-analytics`: Point-in-time summary, evolution series, external-flow
  separation, concentration, benchmark comparison, and completeness semantics.

### Modified Capabilities

- `deterministic-queries`: Extend allocation and historical queries with
  asset-level valued grouping and reusable completeness metadata.
- `market-data-valuation`: Store and select historical benchmark observations
  deterministically.
- `api-contract`: Document analytics endpoints, parameters, response formulas,
  provenance, and incomplete-result behavior.

## Impact

- Adds API endpoints and OpenAPI schemas for portfolio analytics and evolution.
- Extends the store and PostgreSQL persistence with benchmark observations.
- Reuses portfolio reconstruction, historical valuation, price, FX, operation,
  and pending-work data.
- Requires deterministic date sampling and aggregation logic plus focused
  accounting, valuation, benchmark, and contract tests.
