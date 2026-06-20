## Why

The finance agent needs a reliable source of structured portfolio data instead of scattered notes, ad hoc files, and agent-local memory. This MVP creates a small deterministic finance data API so the agent can retrieve raw facts and compose its own analysis outside the application.

## What Changes

- Add persistent records for investments, operations, news, watchlist assets, virtual portfolios, virtual positions, benchmarks, and portfolio snapshots.
- Add deterministic read APIs for current portfolio, historical portfolio state, allocations, operation history, news retrieval, virtual portfolio comparison, daily raw data packages, and changes since a prior cursor.
- Add processing-control APIs so agents can mark news, operations, and snapshots as reviewed or processed.
- Add an API contract based on REST, PostgreSQL-backed persistence, token-based agent authentication, and checked-in OpenAPI documentation.
- Exclude investment intelligence from the MVP: recommendation, news impact scoring, thesis violation detection, risk scoring, and smart alert generation remain agent responsibilities.

## Capabilities

### New Capabilities

- `financial-records`: CRUD and lifecycle behavior for investments, operations, news, watchlist assets, virtual portfolios, virtual positions, benchmarks, and snapshots.
- `deterministic-queries`: Read-only portfolio, allocation, news, daily package, historical state, and change-detection queries with no embedded intelligence.
- `processing-control`: State transitions for marking agent processing progress on news, operations, snapshots, and pending work queues.
- `api-contract`: REST API, OpenAPI documentation, token authentication, error semantics, and versioning constraints for the MVP.

### Modified Capabilities

- None. This is a new project with no existing OpenSpec capabilities.

## Impact

- Creates a new project under `/home/node/.openclaw/jarvis/projects/finance-data-api`.
- Adds an OpenSpec planning baseline for a future backend service backed by PostgreSQL.
- Establishes API and data requirements before implementation starts.
- Does not change the existing `finance-agent` project or any live agent behavior yet.
