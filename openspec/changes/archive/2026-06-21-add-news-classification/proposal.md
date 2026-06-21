## Why

Collected news is factual and queryable, but agents cannot persist structured,
traceable judgments about importance, economic scope, affected countries,
currencies, sectors, companies, or investments. A separate classification
layer is needed so inferred impact can support agent queries without being
misrepresented as publisher-provided fact.

## What Changes

- Add immutable, versioned news classifications that remain separate from
  `news_items` and identify the classifier, classifier version, external run,
  confidence, evidence, creation time, and supersession lineage.
- Model overall importance, expected impact horizon, geographic and economic
  scope, countries, currencies, sectors, free-form tags, and structured impact
  targets.
- Distinguish objectively related investments from inferred impact targets;
  each inferred target carries direction, magnitude, confidence, and rationale.
- Add an authenticated API for agents to create classifications idempotently,
  replay identical submissions, supersede earlier classifications, and retrieve
  classification history.
- Add review workflow endpoints so a human or trusted agent can approve, reject,
  or record notes without rewriting the submitted classification.
- Add bounded classification queries by news, classifier, importance, review
  status, country, currency, sector, company/investment, direction, confidence,
  and publication interval.
- Add an unclassified-news work queue without coupling news ingestion success
  or news processing state to classifier availability.
- Keep recommendations, trading actions, portfolio-specific advice, automatic
  consensus, sentiment claims, and automatic model invocation outside this
  change.

## Capabilities

### New Capabilities

- `news-classification`: Versioned agent-generated classifications, structured
  impact targets, provenance, confidence, evidence, idempotency, supersession,
  review, and classification queries.

### Modified Capabilities

- `api-contract`: Document classification creation, history, review, queue, and
  filtered-query endpoints with explicit request, response, conflict, and
  validation schemas.
- `processing-control`: Extend pending-work semantics with unclassified news
  and unreviewed classifications while keeping factual news processing and
  classification review as separate states.

## Impact

- Adds additive PostgreSQL tables and indexes for classifications, target
  impacts, review state, evidence, and idempotency.
- Adds domain types, validation, store interfaces, in-memory persistence, and
  PostgreSQL persistence.
- Extends the versioned REST API, OpenAPI contract, pending-work response, and
  agent usage documentation.
- Requires stable country, currency, sector, direction, magnitude, horizon,
  confidence, and review-status semantics.
- Requires tests for idempotent replay, conflicts, immutable history,
  supersession, target validation, review audit, query filters, pending work,
  PostgreSQL reload, and contract alignment.
