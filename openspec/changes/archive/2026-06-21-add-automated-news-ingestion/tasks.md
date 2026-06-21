## 1. Collector Contract And Dependency Selection

- [x] 1.1 Define typed source, adapter configuration, normalized candidate, collection window, source state, run status, health, and diagnostic contracts.
- [x] 1.2 Build representative fixtures for RSS 2.0, Atom, RDF, redirects, malformed XML, missing dates, future dates, duplicate GUIDs, large feeds, and article pages.
- [x] 1.3 Compare maintained feed-parser and article-extraction libraries against the fixtures and document the selected dependencies and size/security behavior.
- [x] 1.4 Define deterministic normalization, canonicalization, hashing, merge, stable-ordering, overlap, hard 24-hour horizon, retry, and freshness rules in tests.

## 2. Database And Domain Model

- [x] 2.1 Add an additive migration for news sources, source state, collection runs, leases, and supporting indexes and constraints.
- [x] 2.2 Enrich news items with source identity, external ID, canonical URL, retrieval metadata, language, region, topics, raw hash, and duplicate-group metadata.
- [x] 2.3 Add a compatibility migration strategy for existing manually created news and test upgrade from the current schema.
- [x] 2.4 Add domain validation and in-memory store behavior for source CRUD, source state, run history, enriched news, and source-scoped idempotency.
- [x] 2.5 Add PostgreSQL persistence and transaction tests for source records, state advancement, run audit, leases, and news deduplication/enrichment.

## 3. Hardened Retrieval Infrastructure

- [x] 3.1 Implement the shared bounded HTTP client with timeouts, redirect validation, accepted content types, user agent, conditional requests, and compressed/decompressed size limits.
- [x] 3.2 Add private-network/unsafe URL rejection, sanitized error capture, and tests proving credentials and unrestricted response bodies are not logged or returned.
- [x] 3.3 Implement retry classification, `Retry-After` handling, exponential backoff with jitter, and source-specific request/concurrency limits.
- [x] 3.4 Implement environment-based secret reference resolution without persisting or returning resolved values.

## 4. Adapter And Normalization Engine

- [x] 4.1 Implement the adapter registry and typed adapter contract without database-defined executable transformations.
- [x] 4.2 Implement RSS, Atom, and RDF parsing with local UTC interval filtering, stable sorting, conditional requests, and incomplete-retention diagnostics.
- [x] 4.3 Implement the Guardian adapter with a maximum 24-hour native date range, bounded pagination, API-key resolution, content fields, and bounded result handling.
- [x] 4.4 Implement publication timestamp validation and configurable future-date rejection, including an explicit events-source exception.
- [x] 4.5 Implement source-scoped external-ID, canonical-URL, and fallback-hash idempotency plus cross-source duplicate grouping.
- [x] 4.6 Implement deterministic enrichment that can add richer factual content without resetting processing state.

## 5. Full Article Content

- [x] 5.1 Implement source-configurable article retrieval as a bounded second stage using the shared HTTP policy.
- [x] 5.2 Implement article content extraction, provenance retention, and full-body persistence for accessible internal-use content.
- [x] 5.3 Preserve valid metadata items when article retrieval fails and record per-item failure counts and sanitized diagnostics.
- [x] 5.4 Add storage-volume fixtures and decide whether first-release bodies remain inline or use compression/external storage.

## 6. Collection State And Orchestration

- [x] 6.1 Implement deterministic explicit and incremental collection-window calculation with the default two-hour overlap and an unconditional lower bound of the fixed upper bound minus 24 hours.
- [x] 6.2 Reject manual windows older than 24 hours and record clamping/unrecoverable-gap diagnostics for missing or stale source state.
- [x] 6.3 Implement atomic expiring source leases that prevent concurrent collection of the same source.
- [x] 6.4 Implement isolated per-source execution with idempotent item persistence and advance successful state only after every accepted item persists.
- [x] 6.5 Implement the bounded-concurrency global trigger for due, all-enabled, and explicitly selected sources.
- [x] 6.6 Persist successful, no-change, partial, skipped, rate-limited, and failed run results with complete counters and sanitized diagnostics.
- [x] 6.7 Implement source health and staleness calculation independently from HTTP success.
- [x] 6.8 Add tests proving first runs, stale state, overlap, explicit windows, and API pagination never request or accept news outside the latest 24 hours.
- [x] 6.9 Add tests proving one source failure, timeout, malformed response, or rate limit does not block sibling sources.

## 7. Source Catalog Seed

- [x] 7.1 Convert the approved research catalog into a checked-in versioned seed manifest with stable slugs and editorial classifications.
- [x] 7.2 Enable the seven core RSS sources and Guardian with reviewed defaults; classify supporting, commercial, benchmark-pending, and disabled sources explicitly.
- [x] 7.3 Implement an idempotent importer that reports created, updated, unchanged, and skipped records without overwriting runtime state or operator-created sources.
- [x] 7.4 Add seed validation tests for adapter configuration, duplicate slugs, endpoint syntax, secret references, and replay behavior.

## 8. REST API And OpenAPI

- [x] 8.1 Add authenticated source create, list, retrieve, and update endpoints with deterministic filters and health output.
- [x] 8.2 Add authenticated collection trigger endpoints with source selection, due/force semantics, 24-hour window validation, concurrency bounds, and per-source results.
- [x] 8.3 Add bounded collection-run list and retrieve endpoints with source, status, trigger, and date filters.
- [x] 8.4 Extend news endpoints and response schemas with enriched provenance, retrieval, content, and duplicate metadata while preserving existing clients where possible.
- [x] 8.5 Extend the checked-in OpenAPI document with explicit source, health, trigger, run, enriched-news, validation, conflict, and operational error schemas.
- [x] 8.6 Add runtime/OpenAPI contract tests for every new operation and representative success, validation, lease-conflict, and failure response.

## 9. CLI And Agent Guidance

- [x] 9.1 Add a thin `news:collect` CLI supporting source slug/ID selection, due-only or forced collection, bounded concurrency, and machine-readable output.
- [x] 9.2 Add source-list and seed/import CLI operations only where they reuse the same application services as REST.
- [x] 9.3 Update agent documentation with source discovery, collection, run diagnosis, freshness interpretation, full-content behavior, and safe retry examples.
- [x] 9.4 Document external cron invocation and operational defaults without embedding scheduler-specific logic in the collector.

## 10. Validation And Rollout

- [x] 10.1 Run targeted domain, migration, persistence, HTTP-policy, parser, adapter, deduplication, article, orchestration, seed, CLI, and API tests.
- [x] 10.2 Run the full test suite, typecheck, lint, build, and strict OpenSpec validation.
- [x] 10.3 Run a controlled collection against the initial enabled sources and review freshness, duplicate rate, article success, response sizes, storage growth, and sanitized failures.
- [x] 10.4 Verify existing manual news CRUD and processing behavior remains compatible and collected enrichment never introduces recommendations, impact scores, sentiment, or thesis judgments.
- [x] 10.5 Document rollout thresholds and keep Alpha Vantage, GDELT, and commercial adapters disabled until their access, quota, and quality benchmarks are approved.
