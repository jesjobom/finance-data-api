## Context

The finance agent needs deterministic portfolio facts that can be queried repeatedly by date, asset, and processing state. The first version should behave like a data service, not an investment-advice engine: it stores facts, preserves auditability, and returns raw or mechanically derived views for the agent to analyze elsewhere.

The project is new, so the design can choose a conservative baseline without migration pressure. JJ's stated preference is for stable, maintainable engineering over quick glue code.

## Goals / Non-Goals

**Goals:**

- Provide a small REST API for finance data ingestion, lookup, and agent consumption.
- Persist data in PostgreSQL with explicit relationships, stable identifiers, timestamps, and soft-delete or inactive states where appropriate.
- Expose deterministic query results that can be tested with fixture data.
- Check in an OpenAPI contract from the beginning.
- Keep agent processing state separate from business facts.

**Non-Goals:**

- Do not generate investment recommendations.
- Do not score news importance, sentiment, risk, or portfolio impact.
- Do not integrate automatically with brokerages in MVP1.
- Do not build a rich end-user UI in MVP1.
- Do not require market-data ingestion beyond user/API-provided facts.

## Decisions

1. Use REST plus OpenAPI for MVP1.
   - Rationale: the agent needs predictable resource and query endpoints, and OpenAPI gives immediate contract documentation and test targets.
   - Alternative considered: GraphQL. Rejected for MVP1 because the query surface is known and deterministic, and GraphQL would add schema and resolver complexity before it pays off.

2. Use PostgreSQL as the persistence layer.
   - Rationale: portfolio data has relational constraints, historical queries, aggregation needs, and transactional writes.
   - Alternative considered: JSON files or SQLite. Rejected because the service is expected to become a reusable backend and needs stronger concurrent access and query semantics.

3. Model operations as the source of position truth.
   - Rationale: current and historical positions should be reproducible from transactions plus snapshots, not manually overwritten totals.
   - Alternative considered: storing only current holdings. Rejected because it loses auditability and makes historical queries unreliable.

4. Keep snapshots as optimization and audit artifacts.
   - Rationale: snapshots help the agent compare state over time and can speed repeated daily queries, while operation history remains the source of truth.
   - Alternative considered: making snapshots the only source of portfolio state. Rejected because snapshot gaps would make history incomplete.

5. Separate processing state from domain records.
   - Rationale: whether an agent reviewed a news item or operation is workflow metadata, not the fact itself.
   - Alternative considered: embedding flags directly into every table only. Rejected because future agents or processing flows may need independent state.

6. Use token authentication for MVP1 agent access.
   - Rationale: a simple bearer token is enough for local/service-to-service MVP usage and can be upgraded later.
   - Alternative considered: full user account auth. Rejected as premature for an agent-facing MVP.

## Risks / Trade-offs

- [Historical position calculations can become complex] -> Keep MVP operation types explicit and add fixture-based tests for buy, sell, income, maturity, contribution, and withdrawal flows.
- [Currency and tax rules can expand scope quickly] -> Store currency as data, expose allocation by currency, and avoid tax/performance advice in MVP1.
- [News entities may be under-modeled] -> Capture source, published timestamp, URL, title, body/summary, related assets, and processing status; defer semantic enrichment to the agent.
- [Token auth is intentionally simple] -> Document it as MVP-only and keep auth behind a small boundary so stronger auth can replace it later.
- [OpenAPI can drift from implementation] -> Add contract validation in the implementation tasks before declaring the backend done.

## Migration Plan

This is a new project, so there is no data migration. Implementation should start with schema migrations and seed fixtures, then expose endpoints behind a local development configuration. Rollback for MVP development is dropping the local database/schema and reverting the project folder.

## Open Questions

- Which backend language/framework should MVP1 use? Conservative default: Java or Kotlin with a lightweight REST stack if JJ wants to align with his backend strengths; otherwise Node/TypeScript is acceptable for fast agent tooling integration.
- Which portfolio cost-basis method is required first: average cost, FIFO, or raw quantity-only tracking?
- Should the first version support multiple users/accounts, or only a single owner namespace for JJ's agent?
