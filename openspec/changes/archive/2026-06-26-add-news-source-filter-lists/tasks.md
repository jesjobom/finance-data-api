## 1. Domain And Validation

- [x] 1.1 Add `candidateFilters` types to `NewsSourceConfig` with whitelist and blacklist rule arrays.
- [x] 1.2 Extend source validation schemas for `mode`, `target`, `value`, `enabled`, and optional `reason`.
- [x] 1.3 Validate regex rules at source create/update and seed-load time with clear structured errors.
- [x] 1.4 Add unit tests for valid filters, invalid regex, empty values, disabled rules, and config round trips.

## 2. Matching Engine

- [x] 2.1 Implement deterministic title/category normalization, including lowercase, trimming, and accent folding.
- [x] 2.2 Implement `contains`, `word`, `exact`, and `regex` matching against title, category, or both.
- [x] 2.3 Implement whitelist-first decision logic with blacklist rejection fallback.
- [x] 2.4 Add focused tests for title matches, category matches, multi-category candidates, whitelist precedence, and default accept behavior.

## 3. Collection Integration

- [x] 3.1 Apply candidate filtering after adapter normalization and before persistence/deduplication.
- [x] 3.2 Count blacklist-filtered candidates as rejected without advancing accepted or created counts.
- [x] 3.3 Add bounded diagnostics identifying the matched rule and candidate identity without exposing large raw payloads.
- [x] 3.4 Add integration tests proving filtered items do not persist and whitelisted items persist even when they also match a blacklist.

## 4. API, Persistence, And Seed

- [x] 4.1 Ensure in-memory and PostgreSQL source persistence round-trip filter configuration unchanged.
- [x] 4.2 Extend OpenAPI schemas for source filter rules and source create/update responses.
- [x] 4.3 Update source seed validation and fixtures to accept optional filters.
- [x] 4.4 Add API and seed replay tests covering filter configuration.

## 5. Validation And Rollout

- [x] 5.1 Run targeted news ingestion, source persistence, OpenAPI, and seed tests.
- [x] 5.2 Run typecheck, full test suite, and strict OpenSpec validation.
- [x] 5.3 Document operator examples for noisy-source blacklist, curated-source whitelist, and regex escape-hatch usage.
