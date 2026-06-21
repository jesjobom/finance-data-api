## ADDED Requirements

### Requirement: Persistent news source registry
The system SHALL store news sources with stable identity, name, adapter type,
endpoint, enabled status, editorial classification, language and region
metadata, access tier, polling policy, freshness threshold, request limits,
validated adapter configuration, and an optional secret reference.

#### Scenario: Register an RSS source
- **WHEN** a client submits a valid RSS source configuration
- **THEN** the system persists it with a stable identifier and returns its non-secret configuration

#### Scenario: Reject unknown adapter configuration
- **WHEN** a client submits an unsupported adapter type or configuration field
- **THEN** the system rejects the source without persisting executable or unvalidated transformation rules

#### Scenario: Hide resolved credentials
- **WHEN** a client retrieves a source that uses a runtime secret
- **THEN** the system returns only the secret reference and never the resolved credential

### Requirement: Adapter-driven collection
The system SHALL retrieve source data through a typed adapter selected by the
source configuration and SHALL normalize adapter output into the common news
candidate contract.

#### Scenario: Collect a timestamped RSS feed
- **WHEN** an enabled RSS source is collected for a UTC interval
- **THEN** the RSS adapter parses supported RSS, Atom, or RDF items, filters them by parsed publication timestamp, and returns normalized candidates in stable order

#### Scenario: Collect a native-date API
- **WHEN** an API adapter supports native date filtering
- **THEN** the adapter sends the bounded collection interval using that API's documented date semantics and normalizes all accepted pages

#### Scenario: Reject an invalid publication timestamp
- **WHEN** a candidate has no parseable publication timestamp
- **THEN** the collector rejects and counts the candidate instead of assigning retrieval time as publication time

### Requirement: Full article content retrieval
The system SHALL support bounded retrieval and storage of full article content
for internal use when the source configuration enables it and the content is
accessible through the configured adapter.

#### Scenario: Enrich a feed item with article content
- **WHEN** a normalized feed item lacks full content and article retrieval is enabled
- **THEN** the collector may fetch the canonical article and store extracted content with the item's provenance

#### Scenario: Preserve metadata when article retrieval fails
- **WHEN** a valid feed item is normalized but its article body cannot be retrieved
- **THEN** the collector persists the metadata item and records the article retrieval failure in collection diagnostics

#### Scenario: Respect access controls
- **WHEN** article content requires unavailable authentication or is blocked by the source
- **THEN** the collector does not bypass the control and retains only the content it could obtain normally

### Requirement: Incremental collection state
The system SHALL maintain source-specific collection state including successful
watermark or cursor, ETag, Last-Modified, latest observed item timestamp, last
attempt, last success, consecutive failures, next eligible poll, and expiring
lease state.

#### Scenario: Advance state after success
- **WHEN** a source collection commits successfully
- **THEN** the system atomically advances its successful state and clears applicable failure state

#### Scenario: Preserve watermark after failure
- **WHEN** fetching, parsing, normalization, or persistence fails
- **THEN** the system records the failure without advancing the last successful watermark

#### Scenario: Receive not-modified response
- **WHEN** a source returns a valid not-modified response to a conditional request
- **THEN** the system records a successful no-change run and retains the existing item watermark

### Requirement: Isolated collection orchestration
The system SHALL provide one orchestration operation that selects eligible
sources and executes each acquired source as an isolated collection run with
bounded concurrency.

#### Scenario: Trigger due sources
- **WHEN** the orchestration operation runs in due-only mode
- **THEN** it attempts collection only for enabled sources whose next poll is due and whose lease is available

#### Scenario: Source failure isolation
- **WHEN** one source fails during a multi-source trigger
- **THEN** other acquired sources continue independently and the trigger reports each source result

#### Scenario: Prevent overlapping source runs
- **WHEN** two workers attempt to collect the same source concurrently
- **THEN** at most one worker acquires the active lease and the other reports that the source was skipped or already running

#### Scenario: Retry a rate-limited source
- **WHEN** a source responds with a retryable rate-limit response
- **THEN** the system honors a valid retry delay or applies bounded exponential backoff with jitter without delaying unrelated sources

### Requirement: Deterministic collection windows
The system SHALL calculate UTC collection windows from the requested interval
or prior successful source state, SHALL apply a configured overlap to
incremental runs, and SHALL never collect a window earlier than 24 hours before
the run's fixed upper bound.

#### Scenario: Run incremental collection
- **WHEN** a source with prior successful state is collected without an explicit start
- **THEN** the collection begins at the later of the prior watermark minus the configured overlap or the fixed upper bound minus 24 hours and ends at that upper bound

#### Scenario: Collect a source without prior state
- **WHEN** a source with no successful collection state is collected
- **THEN** the collection begins no earlier than 24 hours before the run's fixed upper bound

#### Scenario: Collect a source with stale state
- **WHEN** a source's prior successful watermark is older than 24 hours before the run's fixed upper bound
- **THEN** the collector clamps the window to the latest 24 hours and records the unrecoverable gap in run diagnostics

#### Scenario: Reject an older manual backfill
- **WHEN** a client requests a collection start earlier than 24 hours before the requested or assigned upper bound
- **THEN** the system rejects the request with a structured validation error and starts no source run

#### Scenario: Filter rolling feeds locally
- **WHEN** a feed protocol does not support native date parameters
- **THEN** the adapter fetches the retained feed and deterministically filters and sorts candidates within the bounded UTC interval

#### Scenario: Bound native API pagination
- **WHEN** a native-date API returns multiple pages
- **THEN** every request and accepted candidate remains within the same fixed 24-hour window and pagination stops when older results are reached

### Requirement: Idempotent normalization and deduplication
The system SHALL derive a stable source-scoped ingestion identity, prevent
duplicate records on replay, and preserve separate publisher provenance when
cross-source candidates appear equivalent.

#### Scenario: Replay the same GUID
- **WHEN** the same source returns an item with a previously ingested external identifier
- **THEN** the system reuses or deterministically enriches the existing news item and creates no duplicate

#### Scenario: Deduplicate without GUID
- **WHEN** a source item has no external identifier but has a canonical URL or deterministic fallback hash
- **THEN** the system uses the documented fallback identity to prevent source-scoped duplication

#### Scenario: Preserve equivalent cross-source coverage
- **WHEN** two sources publish items with the same canonical URL or content hash
- **THEN** the system retains both source records and exposes their duplicate-group relationship

#### Scenario: Preserve processing state during enrichment
- **WHEN** a replay provides a richer summary or body for an already processed item
- **THEN** factual content may be enriched without clearing its processing metadata

### Requirement: Collection run audit
The system SHALL persist a collection run for every acquired source execution
with source, trigger, requested window, timestamps, status, counts, sanitized
diagnostics, and resulting state summary.

#### Scenario: Inspect successful run
- **WHEN** an agent retrieves a completed successful run
- **THEN** the response includes fetched, accepted, created, enriched, duplicate, rejected, and article-failure counts

#### Scenario: Inspect failed run
- **WHEN** an agent retrieves a failed run
- **THEN** the response contains a sanitized error classification and no credential values or unrestricted response body

### Requirement: Source freshness monitoring
The system SHALL evaluate source freshness independently from HTTP collection
success using the latest accepted publication timestamp and source-specific
threshold.

#### Scenario: Mark a stale healthy feed
- **WHEN** a feed remains fetchable but its latest accepted item exceeds the configured freshness threshold
- **THEN** the system reports the source as stale rather than healthy

#### Scenario: Distinguish low-cadence analysis
- **WHEN** an official-analysis source has a longer configured freshness threshold than a breaking-news source
- **THEN** the system evaluates each source against its own threshold

### Requirement: Idempotent source catalog seed
The system SHALL provide a versioned, repeatable importer for the approved news
source catalog using stable source slugs.

#### Scenario: Import the catalog initially
- **WHEN** the seed runs against an empty source registry
- **THEN** it creates the approved sources with their adapter, classification, policy, and enabled status

#### Scenario: Replay the catalog seed
- **WHEN** the same seed version runs again
- **THEN** it creates no duplicate sources and reports deterministic created, updated, unchanged, and skipped counts

#### Scenario: Preserve operator source state
- **WHEN** the seed updates approved descriptive fields for an existing source
- **THEN** it does not overwrite runtime collection state or delete operator-created sources

### Requirement: Shared REST and CLI collection service
The system SHALL expose source discovery and collection through the versioned
REST API and a CLI that invoke the same application services.

#### Scenario: List sources for an agent
- **WHEN** an authenticated agent lists news sources
- **THEN** the API returns stable, filterable source metadata and current health without exposing secrets

#### Scenario: Collect one source from CLI
- **WHEN** an operator invokes the CLI with a source slug or identifier
- **THEN** the CLI invokes the common collection service and returns a machine-readable run result
