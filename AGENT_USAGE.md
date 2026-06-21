# Production Agent Usage Guide

This guide is for agents that consume the Finance Data API in production-like use.
It is not a development, build, migration, or testing guide.

## Purpose

Finance Data API is a deterministic data service for the finance agent. It stores
and returns factual portfolio data:

- investments
- operations
- news
- watched assets
- virtual portfolios and virtual positions
- benchmarks
- portfolio snapshots
- processing state
- deterministic portfolio queries
- brokerage accounts and explicit opening positions
- historical asset prices and foreign-exchange rates
- external statements and reconciliation results

The API must not be used to generate investment advice. Recommendation, risk
scoring, thesis checks, sentiment, and smart alerts belong outside this
service. External agents may persist versioned news-impact classifications, but
the API stores and audits those inferences rather than generating them.

## Base URL And Authentication

Use the production base URL provided by the runtime or deployment environment:

```bash
BASE_URL="https://finance-data-api.example"
```

Protected endpoints require a bearer token:

```bash
TOKEN="$FINANCE_DATA_API_TOKEN"
AUTH_HEADER="Authorization: Bearer $TOKEN"
```

Unauthenticated endpoints:

- `GET /health`
- `GET /openapi.json`

All `/v1/*` endpoints are authenticated.

Never print, log, or expose bearer tokens.

## Production Health Checks

Use `/health` only as a process liveness check:

```bash
curl -fsS "$BASE_URL/health"
```

Expected response:

```json
{"status":"ok"}
```

This endpoint confirms that the HTTP process responds. It does not currently
check PostgreSQL connectivity or prove datastore readiness.

Use `/openapi.json` to verify the API contract is reachable:

```bash
curl -fsS "$BASE_URL/openapi.json" >/tmp/finance-data-api-openapi.json
```

Verify authenticated connectivity with a read-only endpoint:

```bash
curl -fsS "$BASE_URL/v1/portfolio/current" -H "$AUTH_HEADER"
```

If this fails:

- `401` or `403` means the token is missing, invalid, or not authorized.
- `404` means the base URL or route is wrong.
- `5xx` means the requested API operation failed; `/health` alone cannot
  distinguish application readiness from datastore readiness.
- connection timeout or DNS failure means the deployment route is unavailable.

Do not run build, install, migration, seed, reset, or development-server commands
from a consuming agent.

## API Conventions

Dates:

- `effectiveDate` uses `YYYY-MM-DD`
- timestamps use ISO datetime, for example `2026-06-17T12:00:00.000Z`

Currencies:

- use 3-letter uppercase codes such as `USD`, `CAD`, `BRL`

Supported asset classes:

- `stock`
- `fii`
- `etf`
- `fixed_income`
- `crypto`
- `cash`
- `other`

Supported operation types:

- `buy`
- `sell`
- `contribution`
- `withdrawal`
- `dividend`
- `yield`
- `redemption`
- `maturity`
- `transfer`
- `split`
- `reverse_split`
- `bonus`

When an endpoint needs an ID, use IDs returned by create or list operations.

## Read-Only Data Access

Current portfolio:

```bash
curl -fsS "$BASE_URL/v1/portfolio/current" -H "$AUTH_HEADER"
```

Portfolio at date:

```bash
curl -fsS "$BASE_URL/v1/portfolio/at/2026-06-17" -H "$AUTH_HEADER"
```

Allocation grouping:

```bash
curl -fsS "$BASE_URL/v1/allocations/assetClass" -H "$AUTH_HEADER"
curl -fsS "$BASE_URL/v1/allocations/currency" -H "$AUTH_HEADER"
curl -fsS "$BASE_URL/v1/allocations/country" -H "$AUTH_HEADER"
curl -fsS "$BASE_URL/v1/allocations/asset/value/2026-06-20?source=manual" -H "$AUTH_HEADER"
```

Point-in-time portfolio analytics:

```bash
curl -fsS "$BASE_URL/v1/portfolio/analytics/2026-06-20?source=manual" \
  -H "$AUTH_HEADER"
```

The response separates `contributions`, `withdrawals`, and `netExternalFlow`
from `gainLoss`. Its fixed formula is:

```text
gainLoss = marketValue - openingValue - netExternalFlow
```

Only `contribution` and `withdrawal` operations are external flows. This value
bridge is not TWR, MWR, IRR, alpha, attribution, tax advice, or a recommendation.

Top-five asset concentration:

```bash
curl -fsS "$BASE_URL/v1/portfolio/concentration/2026-06-20?top=5&source=manual" \
  -H "$AUTH_HEADER"
```

Portfolio evolution with an optional benchmark:

```bash
curl -fsS \
  "$BASE_URL/v1/portfolio/evolution?from=2026-01-01&to=2026-06-20&interval=monthly&source=manual&benchmarkId=replace-with-benchmark-id" \
  -H "$AUTH_HEADER"
```

Evolution supports `daily`, `weekly`, and `monthly`. Weekly periods end Sunday.
The range is limited to 10 years and 366 samples. Portfolio and benchmark
series normalize to 100 at their first common complete sample. A missing
benchmark interval remains an explicit gap.

Daily raw package:

```bash
curl -fsS "$BASE_URL/v1/daily-package/2026-06-17" -H "$AUTH_HEADER"
```

Latest snapshot:

```bash
curl -fsS "$BASE_URL/v1/snapshots/latest" -H "$AUTH_HEADER"
```

Pending processing work:

```bash
curl -fsS "$BASE_URL/v1/pending-work" -H "$AUTH_HEADER"
```

Changes since a cursor:

```bash
curl -fsS "$BASE_URL/v1/changes?cursor=2026-06-17T00:00:00.000Z" -H "$AUTH_HEADER"
```

## Resource Endpoints

Investments:

- `GET /v1/investments`
- `POST /v1/investments`
- `GET /v1/investments/{id}`
- `PATCH /v1/investments/{id}`
- `POST /v1/investments/{id}/deactivate`

Stable assets:

- `GET /v1/assets`
- `POST /v1/assets`
- `GET /v1/assets/{id}`

Operations:

- `GET /v1/operations`
- `POST /v1/operations`
- `GET /v1/operations/{id}`
- `PATCH /v1/operations/{id}`
- `GET /v1/operations/{id}/revisions`
- `POST /v1/operations/{id}/review`

Portfolio accounting:

- `GET/PATCH /v1/portfolios/{id}`
- `GET/POST /v1/accounts`
- `GET /v1/accounts/{id}`
- `GET/POST /v1/opening-positions`
- `GET/POST /v1/prices`
- `GET/POST /v1/fx-rates`
- `GET/POST /v1/statements`
- `GET /v1/statements/{id}`
- `POST /v1/statements/{id}/reconcile`
- `GET /v1/reconciliations`
- `GET /v1/reconciliations/{id}`

News:

- `GET /v1/news`
- `POST /v1/news`
- `GET /v1/news/{id}`
- `PATCH /v1/news/{id}`
- `POST /v1/news/{id}/process`
- `GET/POST /v1/news-sources`
- `GET/PATCH /v1/news-sources/{id}`
- `GET/POST /v1/news-collection-runs`
- `GET /v1/news-collection-runs/{id}`

News collection rules:

- Discover source configuration and current health through
  `GET /v1/news-sources`; resolved secret values are never returned.
- Trigger routine work with `{"mode":"due"}`. Use `selected` plus `sourceIds`
  for diagnosis or targeted collection.
- Every collection window is limited to the latest 24 hours relative to its
  fixed upper bound. Older manual backfills are rejected.
- A stale source watermark is clamped to 24 hours and the unrecoverable gap is
  reported in run diagnostics.
- Source failures are isolated. Inspect each returned run and use
  `GET /v1/news-collection-runs` for failure and freshness diagnosis.
- Full article content is stored when enabled and normally accessible. Failure
  to retrieve a body can make a collection run `partial`, but it does not
  discard valid feed/API metadata. In these cases the news item may have
  `body` absent while still retaining title, URL, published time, source,
  summary when available, and tags.
- `editorialType` distinguishes news, official analysis, research, opinion,
  advocacy, and aggregators; agents must preserve that distinction.

News classifications:

- `POST /v1/news/{newsId}/classifications` creates or idempotently replays an
  agent classification.
- Use a stable `classifierId`, a model/ruleset `classifierVersion`, and a unique
  `externalRunId`. Reusing the same identity with different content is a
  conflict.
- `GET /v1/news/{newsId}/classifications?current=true` returns every current
  classifier lineage; the API does not synthesize consensus.
- `GET /v1/news-classifications` filters by importance, review state, country,
  currency, sector, company/investment, direction, confidence, and publication
  interval.
- Corrections create a new classification with
  `supersedesClassificationId`; prior inference remains immutable.
- Reviews are appended through
  `POST /v1/news-classifications/{id}/reviews`. Approval is workflow acceptance,
  not conversion of inference into fact.
- Unresolved company targets can later be linked through
  `POST /v1/news-classification-targets/{id}/resolutions` without rewriting the
  classifier payload.
- `GET /v1/news-classification-queue` exposes `unclassified`, `unreviewed`, and
  `needs_revision` work independently from news `processedAt`.
- Confidence is bounded from 0 to 1. Use `uncertain` direction and `unknown`
  magnitude instead of inventing precision.
- Classification requests reject recommendations, trades, price targets,
  expected returns, thesis status, and unknown fields.

Watched assets:

- `GET /v1/watched-assets`
- `POST /v1/watched-assets`

Virtual portfolios:

- `GET /v1/virtual-portfolios`
- `POST /v1/virtual-portfolios`
- `POST /v1/virtual-portfolios/{portfolioId}/positions`
- `GET /v1/virtual-portfolios/{portfolioId}/compare`

Benchmarks and snapshots:

- `GET /v1/benchmarks`
- `POST /v1/benchmarks`
- `GET /v1/benchmark-observations`
- `POST /v1/benchmark-observations`
- `POST /v1/snapshots`
- `GET /v1/snapshots/latest`

Portfolio queries:

- `GET /v1/portfolio/current`
- `GET /v1/portfolio/at/{date}`
- `GET /v1/portfolio/value/{date}`
- `GET /v1/portfolio/analytics/{date}`
- `GET /v1/portfolio/concentration/{date}`
- `GET /v1/portfolio/evolution`
- `GET /v1/allocations/{by}`
- `GET /v1/allocations/{by}/value/{date}`
- `GET /v1/daily-package/{date}`
- `GET /v1/changes`
- `GET /v1/pending-work`

Use `GET /openapi.json` as the source of truth for routes, parameters, request
and response schemas, authentication, and documented status codes. Successful
responses use explicit schemas or reusable component references, including
partial and unavailable analytics variants.

## Recommended Agent Workflow

For portfolio accounting tasks, use this order:

1. Read `/openapi.json` and verify `/health`.
2. Resolve or create the stable asset through `/v1/assets`.
3. Resolve or create the brokerage account through `/v1/accounts`.
4. Read the portfolio configuration and its `reliableFrom` boundary.
5. For a pre-existing portfolio, record opening positions on `reliableFrom`;
   never synthesize earlier trades.
6. Import later operations with `importSource` and `externalId`.
7. Add dated prices and FX observations before requesting historical valuation.
8. Create a dated statement and reconcile it. Treat reconciliation as a report,
   not permission to alter ledger facts automatically.

Prefer stable IDs returned by the API. Assets are identified independently from
custody accounts; the same asset ID can be held in multiple accounts.

For news classification tasks, use this order:

1. Pull work from
   `/v1/news-classification-queue?kind=unclassified&limit=...`.
2. Read the full news record from `/v1/news/{id}` if the queue response is not
   enough for classification evidence. Treat `body` as optional: some valid
   news items only have title, URL, summary, and source metadata because the
   publisher blocks full-article retrieval.
3. Submit one classification per `newsId`, `classifierId`, and `externalRunId`.
   Keep `classifierId` stable for the agent or ruleset, and make
   `externalRunId` unique for that specific analysis run.
4. Store only the inferred classification, confidence, rationale, and evidence
   keys that are supported by the available fields. Do not infer facts that
   require missing article text, and do not write recommendations, trades, price
   targets, expected returns, thesis judgments, or portfolio-specific advice.
5. If the same run is retried after a network failure, send the identical
   payload. A `200` replay is success. A `409` means the run identity was reused
   with different content and must be investigated, not force-rewritten.
6. To correct an earlier classification, create a new one with
   `supersedesClassificationId`. Never mutate or hide the earlier inference.
7. For unresolved companies, submit a `company` target first. Link it to a
   known investment later through
   `/v1/news-classification-targets/{targetId}/resolutions` with actor and
   reason.
8. Review queues are separate from classification queues. Approval means the
   workflow accepts the inference for use; it does not make the inference a
   factual publisher claim or investment advice.

## Reliability, Conflicts, And Missing Data

- Do not present calculated history before `reliableFrom` as trustworthy.
- Omit `totalCost` when opening cost basis is unknown. Do not send zero unless
  zero is the known factual value.
- An imported operation returns `201` when created and `200` when an identical
  import is replayed.
- A reused import identity with different facts returns `409`; do not retry it
  as a new operation with a fabricated identifier.
- An operation correction requires `actor`, `reason`, `expectedVersion`, and
  `changes`. A stale version returns `409`; refetch before deciding whether to
  retry.
- Valuation responses can contain missing price or FX diagnostics. Never replace
  missing historical observations with current market data.
- Analytics responses use `complete`, `partial`, or `unavailable`. Inspect every
  diagnostic before presenting a total, percentage, gain/loss, or comparison as
  complete.
- Statements and market-data observations are factual source records. Preserve
  their original source identifiers and dates.

## Minimal Write Examples

Create a stable asset:

```bash
curl -fsS -X POST "$BASE_URL/v1/assets" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "AAPL",
    "name": "Apple Inc.",
    "assetClass": "stock",
    "currency": "USD",
    "market": "NASDAQ",
    "country": "US"
  }'
```

Create an idempotently importable operation:

```bash
curl -fsS -X POST "$BASE_URL/v1/operations" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{
    "investmentId": "replace-with-investment-id",
    "accountId": "account_default",
    "type": "buy",
    "effectiveDate": "2026-06-17",
    "quantity": 10,
    "price": 100,
    "currency": "USD",
    "fees": 1.50,
    "importSource": "broker-export",
    "externalId": "trade-2026-06-17-001",
    "notes": "Initial position"
  }'
```

Initialize an existing portfolio without inventing history:

```bash
curl -fsS -X PATCH "$BASE_URL/v1/portfolios/portfolio_default" \
  -H "$AUTH_HEADER" -H "Content-Type: application/json" \
  -d '{"baseCurrency":"CAD","reliableFrom":"2026-01-01"}'

curl -fsS -X POST "$BASE_URL/v1/opening-positions" \
  -H "$AUTH_HEADER" -H "Content-Type: application/json" \
  -d '{
    "portfolioId":"portfolio_default",
    "accountId":"account_default",
    "investmentId":"replace-with-investment-id",
    "effectiveDate":"2026-01-01",
    "quantity":10,
    "currency":"USD",
    "totalCost":800
  }'
```

For imported operations, always send `importSource` and `externalId` together.
Replaying an identical source/account/external-ID tuple returns the existing
operation; changing facts under the same tuple returns `409 conflict`.

Correct an operation without losing audit history:

```bash
curl -fsS -X PATCH "$BASE_URL/v1/operations/replace-with-operation-id" \
  -H "$AUTH_HEADER" -H "Content-Type: application/json" \
  -d '{
    "actor":"finance-agent",
    "reason":"Correct quantity from broker confirmation",
    "expectedVersion":1,
    "changes":{"quantity":12}
  }'
```

After a `409`, fetch the operation again and inspect its revisions. Do not
blindly increase `expectedVersion`.

Value a historical date:

```bash
curl -fsS "$BASE_URL/v1/portfolio/value/2026-06-20?source=manual" \
  -H "$AUTH_HEADER"
```

The response includes the selected price and FX observation IDs. Missing
historical data is returned explicitly and is never replaced by a current quote.
Without a `source` query parameter, the API selects the latest observation on or
before the requested date, then uses source name and observation ID as stable
tie-breakers.

Record a benchmark observation before requesting benchmark comparison:

```bash
curl -fsS -X POST "$BASE_URL/v1/benchmark-observations" \
  -H "$AUTH_HEADER" -H "Content-Type: application/json" \
  -d '{
    "benchmarkId":"replace-with-benchmark-id",
    "effectiveAt":"2026-06-20T20:00:00.000Z",
    "value":125.42,
    "currency":"USD",
    "source":"manual"
  }'
```

Reconcile a brokerage statement:

```bash
STATEMENT_ID="$(
  curl -fsS -X POST "$BASE_URL/v1/statements" \
    -H "$AUTH_HEADER" -H "Content-Type: application/json" \
    -d '{
      "accountId":"account_default",
      "statementDate":"2026-06-20",
      "source":"broker-export",
      "externalId":"statement-2026-06-20",
      "lines":[
        {"market":"NASDAQ","symbol":"AAPL","quantity":10,"currency":"USD"}
      ]
    }' | jq -r .id
)"

curl -fsS -X POST "$BASE_URL/v1/statements/$STATEMENT_ID/reconcile" \
  -H "$AUTH_HEADER"
```

Reconciliation is non-mutating. Correct ledger facts only through an audited
operation revision with `actor`, `reason`, and `expectedVersion`.

Create a news item:

```bash
curl -fsS -X POST "$BASE_URL/v1/news" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "example-source",
    "title": "Example headline",
    "url": "https://example.com/news",
    "publishedAt": "2026-06-17T12:00:00.000Z",
    "relatedInvestmentIds": ["replace-with-investment-id"]
  }'
```

Only write factual records. Do not store recommendations, opinions, generated
investment conclusions, or unverifiable claims as factual portfolio data.

Create an agent-generated news classification:

```bash
curl -fsS -X POST "$BASE_URL/v1/news/replace-with-news-id/classifications" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{
    "classifierId": "macro-impact-agent",
    "classifierType": "agent",
    "classifierVersion": "2026-06-21-rules-v1",
    "externalRunId": "run-2026-06-21T18-45-00Z-news-001",
    "importance": "high",
    "scope": "country",
    "horizon": "short_term",
    "overallConfidence": 0.74,
    "tags": ["tariffs", "trade-policy"],
    "countries": ["US", "IN"],
    "currencies": ["USD", "INR"],
    "sectors": [
      {"taxonomy": "gics", "code": "industrials", "label": "Industrials"}
    ],
    "evidence": [
      {
        "key": "headline",
        "sourceField": "title",
        "explanation": "Headline identifies a trade-policy event involving India and the US."
      }
    ],
    "targets": [
      {
        "targetType": "currency",
        "targetKey": "INR",
        "direction": "uncertain",
        "magnitude": "unknown",
        "confidence": 0.55,
        "rationale": "Trade-policy uncertainty may affect currency expectations, but direction is not clear from the source alone.",
        "evidenceKeys": ["headline"]
      }
    ]
  }'
```

The same payload under the same `classifierId` and `externalRunId` replays
idempotently. Changing the payload under that identity returns `409 conflict`.
When confidence or direction is weak, use `uncertain` and `unknown` instead of
inventing precision.

Append a classification review:

```bash
curl -fsS -X POST "$BASE_URL/v1/news-classifications/replace-with-classification-id/reviews" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d '{
    "reviewer": "finance-review-agent",
    "decision": "needs_revision",
    "notes": "Country impact is plausible, but company impact needs more evidence."
  }'
```

A review is append-only workflow state. It never rewrites the classification
payload and never converts an inference into a factual news field.

## Agent Safety Rules

- Treat the API as a factual data store, not an investment advisor.
- Prefer read-only endpoints unless the task explicitly requires writing data.
- Validate payloads against `/openapi.json` before writing.
- Use `/v1/assets` for stable asset identity; keep brokerage custody in
  `/v1/accounts`.
- Preserve original dates, currencies, quantities, prices, and source URLs.
- Do not invent missing factual values. Leave optional fields absent when unknown.
- Never turn a reconciliation discrepancy into an automatic ledger correction.
- Never retry a `409` by changing factual identity fields solely to force a write.
- Never retry a classification `409` by fabricating a new `externalRunId` unless
  it is genuinely a new analysis run with an intentionally corrected payload.
- Never present a news classification as publisher fact, human-approved truth,
  portfolio advice, or an automatic trade signal.
- Never describe normalized benchmark comparison as formal portfolio return,
  alpha, or investment advice.
- Do not expose API tokens, database credentials, or deployment internals in chat.
- Do not run development commands from this guide; consuming agents should only
  call the deployed API.
