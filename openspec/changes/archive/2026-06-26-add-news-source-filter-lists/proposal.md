## Why

News sources can be noisy even when the adapter and collection window are
correct. Operators need per-source inclusion and exclusion rules so each source
can be tuned without changing adapter code or deleting useful sources from the
catalog.

## What Changes

- Add per-source whitelist and blacklist filtering rules evaluated against
  normalized candidate title and category values before persistence.
- Give whitelist matches priority over blacklist matches.
- Support safe matching modes for common cases and regex as an explicit escape
  hatch.
- Record filter decisions in collection diagnostics and counters so operators
  can explain why a candidate was accepted or rejected.
- Expose filter configuration through the existing source registry API, seed
  manifest, and CLI/service path.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `news-source-ingestion`: Add per-source candidate whitelist and blacklist
  filtering during adapter-driven collection.

## Impact

- Extends `NewsSourceConfig`, source validation, source persistence, OpenAPI
  schemas, and seed manifest validation.
- Updates the collection pipeline to evaluate candidate filters after adapter
  normalization and before item acceptance/deduplication.
- Adds tests for filter matching, whitelist precedence, regex validation,
  diagnostics, API contracts, seed replay, and PostgreSQL persistence.
