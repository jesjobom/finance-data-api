## Context

The service already stores factual news items and exposes CRUD and processing
endpoints, but `source` is free text and all ingestion is external and manual.
The economic-news research catalog contains mostly RSS/RDF feeds plus a smaller
set of APIs with materially different authentication, query, pagination, and
rate-limit behavior. Agents need one stable source registry and invocation
contract rather than embedding endpoint knowledge in prompts or scripts.

The first implementation runs inside the existing Node.js/Fastify/PostgreSQL
service. It must tolerate unavailable, stale, malformed, large, slow, and
rate-limited sources without allowing one source to block the rest. Full article
content may be retrieved and retained because this deployment is for internal
use, but provenance and access classification remain required.

## Goals / Non-Goals

**Goals:**

- Make the database and API the operational source of truth for news sources.
- Cover most sources through reusable protocol adapters while supporting
  explicit adapters for APIs with distinct semantics.
- Provide idempotent incremental collection, bounded recovery windows, source
  isolation, freshness diagnostics, and auditable collection runs.
- Guarantee that every source request is bounded to at most the latest 24 hours,
  even when no previous source state exists or the stored state is older.
- Expose the same application service through REST and a thin CLI.
- Seed the reviewed source catalog repeatably and preserve editorial labels.
- Retrieve and store full article content when an adapter can obtain it.

**Non-Goals:**

- Executing arbitrary user-provided code, JSONPath programs, or transformation
  expressions stored in the database.
- News recommendation, impact scoring, sentiment scoring, claim verification,
  summarization, or portfolio thesis evaluation.
- Distributed queues or a separate scheduler service in the first release.
- Circumventing authentication, paywalls, bot protections, or source access
  controls.
- Treating every configured source as equally authoritative.

## Decisions

### Use adapters by retrieval family, not by publisher

Define a typed adapter contract that accepts a validated source configuration,
collection window, prior state, and HTTP client, then returns normalized
candidates plus updated cursor and HTTP validator state.

The first adapter set is:

- `rss`: RSS 2.0, Atom, and RDF feeds with local timestamp filtering;
- `guardian`: native date range, API key, pagination, and optional content
  fields;
- later explicit `alpha-vantage` and `gdelt` adapters after their production
  quotas and behavior are benchmarked.

Source-specific differences that do not alter protocol semantics, such as date
field preference, response-size ceiling, redirects, user agent, stale
threshold, overlap, and article-fetch policy, remain validated configuration.
An adapter per publisher would duplicate parsing and retry logic. A universal
database-defined HTTP transformation engine was rejected because it hides code
in data and weakens validation, review, security, and tests.

RSS, Atom, and RDF parsing uses `fast-xml-parser`, selected for its maintained
TypeScript-compatible API, configurable text/attribute handling, and support
for parsing bounded response strings without DOM/browser dependencies. Full
article extraction initially uses a conservative bounded `article`, `main`, or
`body` text fallback rather than adding a broad readability dependency before
real-source extraction quality is measured.

### Separate source identity, mutable collection state, and run audit

Use three records:

- `news_sources` for stable identity, adapter, endpoint, classification,
  schedule, limits, and validated configuration;
- `news_source_state` for mutable cursor, ETag, Last-Modified, freshness,
  failure count, retry time, and lease;
- `news_collection_runs` for immutable execution intent and result counts,
  timing, window, status, and sanitized errors.

This prevents operational state from polluting source configuration and retains
enough history to diagnose missed or duplicated news.

### Store secret references, never secret values

Source configuration contains a `secretRef` such as `GUARDIAN_API_KEY`; runtime
configuration resolves it from the process environment. API responses and run
errors never expose the resolved value. Arbitrary request headers containing
credentials are not accepted as source configuration.

### Orchestrate globally but execute and commit per source

One trigger selects enabled sources whose `nextPollAt` is due and attempts an
atomic source lease. Every acquired source runs independently and records its
own run. It begins persistence only after a valid adapter result and advances
the successful watermark only after every accepted item has persisted.

News items are written idempotently rather than held in one potentially long
transaction with source state. If persistence fails partway through a large
source result, the watermark does not advance and the next run safely replays
already written items through source-scoped deduplication. This avoids holding
database locks while processing a large batch and preserves successful factual
records without falsely claiming collection continuity.

The global trigger does not hold one transaction across sources. Concurrency is
bounded, and a source failure cannot fail successful sibling runs. A manual
trigger can target all due sources, all enabled sources, or explicit source
IDs. Cron remains an external invocation concern; the service provides the
deterministic trigger operation.

### Normalize collection windows with source capabilities

The orchestrator calculates a UTC `{from,to}` window using the prior successful
watermark and a configurable overlap, defaulting to two hours. Native-date APIs
receive the bounded interval. Feed adapters fetch the current retained feed,
parse item timestamps, sort locally, and filter locally.

Every calculated or client-requested window has a hard lower bound of
`to - 24 hours`. When no successful state exists, the run starts at that lower
bound. When the prior watermark and overlap are older, they are clamped to that
lower bound. A manual request whose `from` is older is rejected rather than
silently presenting a partial historical backfill as complete. Pagination and
follow-up requests remain inside the same fixed window and stop once candidates
are older than its lower bound.

This deliberately gives up recovery of news missed more than one day ago. It
limits source load, page traversal, connection volume, and blocking risk. The
collector records the clamping or unrecoverable gap in run diagnostics so an
old watermark is not mistaken for complete continuity.

Future-dated items beyond a small configured tolerance are rejected unless the
source is explicitly classified as an events source. Missing or invalid
timestamps are counted and rejected rather than silently assigned retrieval
time. Backfills older than 24 hours are not supported, regardless of source
retention or native API capability.

### Deduplicate at source and cross-source levels without losing provenance

Within a source, prefer a normalized external ID/GUID; otherwise use canonical
URL; otherwise use a deterministic hash of normalized source, title, and
publication timestamp. Enforce a database uniqueness constraint on the
source-scoped identity.

Cross-source URL or content hashes identify likely duplicates but do not erase
separate publisher records. This preserves provenance while allowing clients to
group equivalent coverage. A replay with richer summary or body may enrich the
existing item according to deterministic merge rules, but it must not reset
processing state.

### Treat article retrieval as a bounded second stage

Feed/API normalization first persists the source-provided metadata and content.
When enabled and a candidate lacks full content, the adapter may fetch the
canonical article using the same bounded HTTP client. Article fetches obey
source-specific concurrency, timeout, redirect, size, and rate limits.

Full content is optional because some sources expose only metadata or require
authentication. Failure to retrieve an article body does not discard a valid
headline item; it is recorded in run diagnostics. The collector does not bypass
access controls.

The first release stores article bodies inline in PostgreSQL. This keeps
transactional provenance and deployment simple; storage growth is measured
during rollout before introducing compression or object storage.

### Use one hardened HTTP client policy

All adapters share explicit connect/request timeouts, redirect limits,
compressed and decompressed response-size ceilings, accepted content types,
conditional requests, a descriptive user agent, retry classification, and
sanitized logging. URLs must use HTTP or HTTPS, and redirects are revalidated.
Private-network access is denied by default for remotely managed source URLs to
reduce SSRF risk.

### Seed through a versioned idempotent importer

Add a checked-in seed manifest derived from the consolidated research CSV.
Stable slugs are the import identity. Re-running the seed updates approved
mutable metadata without deleting operator-created sources or overwriting
runtime state. Core RSS sources and Guardian are enabled initially; benchmark
or commercial sources are retained with explicit disabled status and reason
where useful.

The research CSV remains evidence and discovery input, not a runtime
dependency.

### Keep CLI and REST as thin application-service clients

REST endpoints and `news:collect` call the same source and collection services.
The CLI supports source slug/ID selection, due-only versus forced collection,
and machine-readable output. It does not implement separate fetching logic.

## Risks / Trade-offs

- [Publisher markup changes can break article extraction] → Keep article
  extraction adapter-owned, optional, bounded, and separately diagnosed.
- [RSS retention cannot guarantee long outage recovery] → Track freshness and
  watermark gaps and expose incomplete recovery; the hard 24-hour horizon
  intentionally prevents older catch-up even when an API supports it.
- [Duplicate stories have unstable URLs and titles] → Combine source-scoped
  uniqueness with canonical URL and content hashes while preserving provenance.
- [One process may overlap scheduled and manual runs] → Use expiring atomic
  source leases and idempotent persistence.
- [Rate limits differ substantially] → Store validated per-source limits and
  respect `Retry-After` with exponential backoff and jitter.
- [Full content increases storage and request cost] → Apply response limits,
  optional compression/storage strategy, and per-source article-fetch policy.
- [A generic RSS parser may encounter malformed XML] → Use a maintained parser,
  adapter fixtures from real feed variants, and fail the source run safely.
- [Seed updates could surprise operators] → Restrict importer ownership to
  documented fields and report created, updated, unchanged, and skipped rows.

## Migration Plan

1. Add additive source, state, run, and news-enrichment schema changes plus
   source-scoped uniqueness indexes.
2. Backfill a stable legacy/manual source record or nullable provenance for
   existing news without rewriting their factual content.
3. Add domain and persistence support, then idempotent seed import.
4. Add hardened HTTP infrastructure and adapter contract with RSS fixtures.
5. Add Guardian and article-content retrieval.
6. Add collection orchestration, leases, run audit, retry/backoff, and stale
   diagnostics, including hard 24-hour window enforcement.
7. Add REST endpoints, CLI, OpenAPI, and agent documentation.
8. Enable core sources gradually and verify duplicate rate, freshness, storage,
   and source-specific failures before enabling broader sets.

Rollback disables all sources and removes trigger routes/CLI use. Additive
tables and enriched columns can remain without affecting existing manual news
CRUD. Destructive schema rollback is deferred until collected data retention is
decided.

## Open Questions

- Define initial global and per-source concurrency defaults from a short
  benchmark in the deployment environment.
- Confirm whether the first delivery includes only RSS and Guardian or also
  includes disabled adapter skeletons for Alpha Vantage and GDELT.
