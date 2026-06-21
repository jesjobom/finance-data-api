## Why

The service can store news but has no operational source registry or automated
way to collect it, so agents must maintain source knowledge and ingestion logic
outside the API. The researched source catalog now provides a strong initial
set of RSS and API sources that should become centrally configurable,
observable, and easy to invoke through both the REST API and a script.

## What Changes

- Add a persistent news-source registry with protocol adapter, endpoint,
  editorial classification, polling policy, request limits, non-secret adapter
  configuration, and secret references.
- Add a hybrid collection engine: reusable adapters for source families such as
  RSS/RDF and explicit adapters for APIs whose authentication, pagination,
  date-range, or response semantics differ.
- Add collection state and run history for cursors, HTTP validators, freshness,
  retries, errors, counts, and auditability.
- Add one orchestration trigger that identifies due sources and executes an
  isolated collection job per source with source-level locking, overlap,
  rate-limit handling, retry, and backoff.
- Enforce a hard 24-hour collection horizon: no automatic or manual run may
  request or retrieve news published before the run upper bound minus one day,
  including first collection and recovery from stale source state.
- Normalize, deduplicate, and persist collected news with stable source
  identity, external identifiers, canonical URLs, retrieval timestamps, raw
  hashes, language, region, topics, and full article content when available.
- Allow full-content retrieval because the collected data is for internal use;
  preserve provenance and access metadata without imposing a metadata-only
  ingestion restriction.
- Expose source discovery and collection-run endpoints for agents and provide a
  CLI script that invokes the same application service for all or selected
  sources.
- Seed the approved initial source catalog from the consolidated research data,
  with core sources enabled and benchmark/deferred sources explicitly
  classified and disabled where appropriate.

## Capabilities

### New Capabilities

- `news-source-ingestion`: Source registration, adapter-driven retrieval,
  scheduling, collection state, freshness monitoring, run audit, normalization,
  deduplication, and full-content ingestion.

### Modified Capabilities

- `financial-records`: Extend news records with stable source provenance,
  retrieval metadata, normalized identifiers, deduplication fields, and
  optional full article content.
- `api-contract`: Document source registry, collection triggers, run history,
  filters, response schemas, and operational error semantics.

## Impact

- Adds additive PostgreSQL migrations for news sources, source state, collection
  runs, and enriched news records.
- Adds domain types, validation, store interfaces, persistence, collection
  services, protocol adapters, orchestration, and a CLI entry point.
- Extends the versioned REST API and checked-in OpenAPI contract.
- Introduces XML/RSS parsing and HTTP-fetch concerns that require bounded
  response sizes, timeouts, redirect handling, conditional requests, and
  source-specific rate limits.
- Uses the economic-news research artifacts as seed input while making the
  database and API the operational source of truth.
- Requires tests for adapter contracts, source isolation, idempotency,
  deduplication, time-window handling, locking, retries, stale-source detection,
  persistence, API contracts, and seed repeatability.
