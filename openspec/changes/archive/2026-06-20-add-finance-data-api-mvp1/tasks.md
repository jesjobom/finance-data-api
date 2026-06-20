## 1. Project Foundation

- [x] 1.1 Choose and scaffold the backend stack for the MVP service.
- [x] 1.2 Add local development configuration for the API and PostgreSQL.
- [x] 1.3 Add migration tooling and a repeatable database reset/seed workflow.
- [x] 1.4 Add baseline test, lint, typecheck, and build commands.

## 2. Data Model

- [x] 2.1 Create migrations for investments, operations, news, watched assets, virtual portfolios, virtual positions, benchmarks, snapshots, and processing state.
- [x] 2.2 Add domain validation for supported asset classes, currencies, operation types, and lifecycle states.
- [x] 2.3 Add repository or data-access tests for creation, update, deactivate, and lookup behavior.
- [x] 2.4 Add fixture data covering real holdings, closed positions, watched assets, virtual portfolios, news, and snapshots.

## 3. API Contract

- [x] 3.1 Create the initial OpenAPI document for all MVP1 endpoints.
- [x] 3.2 Implement bearer-token authentication for protected endpoints and unauthenticated healthcheck.
- [x] 3.3 Implement structured validation and error response behavior.
- [x] 3.4 Add contract validation so implemented routes stay aligned with OpenAPI.

## 4. Financial Records API

- [x] 4.1 Implement CRUD/lifecycle endpoints for investments.
- [x] 4.2 Implement operation creation and query endpoints.
- [x] 4.3 Implement news creation, update, linking, and query endpoints.
- [x] 4.4 Implement watched asset endpoints.
- [x] 4.5 Implement virtual portfolio and virtual position endpoints.
- [x] 4.6 Implement benchmark endpoints.
- [x] 4.7 Implement snapshot creation and lookup endpoints.

## 5. Deterministic Queries

- [x] 5.1 Implement current portfolio consolidation from operations.
- [x] 5.2 Implement portfolio-at-date query.
- [x] 5.3 Implement allocation queries by asset class, currency, market/country, and broker/custodian.
- [x] 5.4 Implement news queries by day, period, held asset, watched asset, and unprocessed status.
- [x] 5.5 Implement daily raw data package query.
- [x] 5.6 Implement changes-since-cursor query.
- [x] 5.7 Implement real versus virtual portfolio comparison query.

## 6. Processing Control

- [x] 6.1 Implement mark-news-processed behavior.
- [x] 6.2 Implement mark-operation-reviewed behavior.
- [x] 6.3 Implement latest-snapshot metadata query.
- [x] 6.4 Implement pending work query grouped by pending item type.
- [x] 6.5 Add audit tests proving processing updates do not mutate factual fields.

## 7. Validation And Delivery

- [x] 7.1 Add targeted tests for portfolio calculations, historical state, allocation grouping, and processing queues.
- [x] 7.2 Run targeted tests and the broad project validation suite.
- [x] 7.3 Document local run, migration, seed, and API usage commands.
- [x] 7.4 Review MVP boundaries and confirm no recommendation, scoring, or investment intelligence slipped into the service.
