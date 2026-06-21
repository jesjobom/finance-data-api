## 1. Classification Contract And Fixtures

- [x] 1.1 Define typed importance, scope, horizon, direction, magnitude, review, classifier provenance, evidence, sector, target, and resolution contracts.
- [x] 1.2 Define normalization and strict validation limits for country codes, currency codes, sector taxonomy/codes, tag slugs, confidence, text lengths, evidence count, and target count.
- [x] 1.3 Define canonical classification payload hashing and idempotency fixtures that exclude server-generated audit fields.
- [x] 1.4 Add representative fixtures for macro, country, currency, sector, known-investment, unresolved-company, mixed-direction, uncertain, parallel-classifier, and revised classifications.

## 2. PostgreSQL Schema And Migration

- [x] 2.1 Add additive storage for classifications with bounded JSONB dimensions/evidence plus relational impact targets, target resolutions, and append-only reviews.
- [x] 2.2 Add idempotency uniqueness, confidence checks, enum checks, normalized target uniqueness, and immutable lineage constraints.
- [x] 2.3 Add indexes for news/classifier lineage, current classification lookup, publication interval, review queues, countries, currencies, sectors, target investments/companies, direction, and confidence.
- [x] 2.4 Add migration contract tests and validate upgrade against the current operational schema without changing factual news records.

## 3. Domain And In-Memory Persistence

- [x] 3.1 Add domain types and Zod schemas for classification create, target, evidence, resolution, review, and filtered-query inputs.
- [x] 3.2 Implement canonical normalization and payload hashing for deterministic idempotency.
- [x] 3.3 Implement in-memory classification creation, identical replay, conflicting replay, retrieval, and stable history ordering.
- [x] 3.4 Implement same-news/same-classifier supersession validation, single direct successor, cycle prevention, and current-lineage derivation.
- [x] 3.5 Implement known-investment validation, unresolved-company targets, and separate audited target resolution.
- [x] 3.6 Implement append-only reviews and deterministic effective review state.

## 4. PostgreSQL Persistence

- [x] 4.1 Implement transactional PostgreSQL creation of classification, dimensions, evidence, and targets.
- [x] 4.2 Implement database-backed idempotent replay and conflict handling under concurrent submissions.
- [x] 4.3 Implement transactional supersession validation and lineage persistence.
- [x] 4.4 Implement review and target-resolution persistence without mutating classification payloads.
- [x] 4.5 Reload classifications, targets, evidence, resolutions, and reviews into the store with stable ordering.
- [x] 4.6 Add PostgreSQL integration tests covering replay, conflict, supersession, parallel classifiers, review history, unresolved targets, and restart/reload.

## 5. Classification Queries

- [x] 5.1 Implement current and historical queries by news item and classifier with deterministic ordering.
- [x] 5.2 Implement bounded filters for importance, review state, country, currency, sector, target investment/company, direction, minimum confidence, and news publication interval.
- [x] 5.3 Implement bounded pagination with deterministic cursor or offset semantics and documented maximum page size.
- [x] 5.4 Add query tests for combined filters, parallel classifiers, superseded records, equal timestamps, and empty results.

## 6. Work Queues And Processing State

- [x] 6.1 Implement the unclassified-news queue independently from `processedAt`.
- [x] 6.2 Implement unreviewed-current and needs-revision classification queues.
- [x] 6.3 Extend pending work with separate unclassified-news and classification-review categories.
- [x] 6.4 Add tests proving news processing, classification existence, and classification review do not change one another implicitly.

## 7. Agent Classification API

- [x] 7.1 Add `POST /v1/news/{newsId}/classifications` with created-versus-replayed response semantics and structured conflicts.
- [x] 7.2 Add news classification history/current endpoints and one-classification retrieval.
- [x] 7.3 Add global filtered classification list endpoints with bounded pagination.
- [x] 7.4 Add append-only classification review endpoints and review-history retrieval.
- [x] 7.5 Add unresolved-company target resolution endpoints with actor and reason audit.
- [x] 7.6 Add unclassified, unreviewed, and needs-revision queue endpoints for classifier/reviewer agents.
- [x] 7.7 Ensure strict request schemas reject recommendation, trade, price-target, expected-return, thesis, and unknown fields.

## 8. OpenAPI And Agent Guidance

- [x] 8.1 Add reusable OpenAPI schemas for classification requests/resources, dimensions, sectors, evidence, targets, resolutions, reviews, idempotent results, pages, filters, and queue entries.
- [x] 8.2 Document every classification, review, resolution, history, query, and queue endpoint with explicit success and error schemas.
- [x] 8.3 Add contract tests for route coverage, component references, required fields, optionality, pagination, replay, and conflict responses.
- [x] 8.4 Update agent guidance with classification submission, external run identity, supersession, evidence, confidence, review, and safe interpretation examples.
- [x] 8.5 Document clearly that approval is workflow acceptance and classification output remains inference rather than factual news or investment advice.

## 9. Validation And Delivery

- [x] 9.1 Run targeted validation, idempotency, lineage, persistence, query, queue, review, resolution, API, and OpenAPI tests.
- [x] 9.2 Run the full test suite, typecheck, lint, build, migration integration, and strict OpenSpec validation.
- [x] 9.3 Exercise the API end to end with at least two classifier identities, one replay, one correction, one disagreement, one review, and one unresolved company resolution.
- [x] 9.4 Review the implementation boundary and confirm no factual news mutation, recommendation, trade action, price target, expected return, consensus synthesis, or automatic model invocation was introduced.
