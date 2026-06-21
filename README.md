# Finance Data API

Deterministic finance data API for the finance agent MVP.

The service stores portfolio facts, custody accounts, opening state, operations, historical prices and FX, brokerage statements, reconciliations, news, watched assets, virtual portfolios, benchmarks, snapshots, and processing state. It intentionally does not produce recommendations, tax advice, impact scores, risk scores, thesis checks, or smart alerts.

## Stack

- Node.js + TypeScript
- Fastify REST API
- Zod request validation
- PostgreSQL migration scripts
- Vitest tests
- Adapter-driven RSS/Atom/RDF and Guardian news collection
- Checked-in OpenAPI document served at `/openapi.json`

The OpenAPI document is authoritative for routes, parameters, request and
response schemas, authentication, and status codes. Contract tests reject empty
successful response schemas and unresolved component references.

## Local Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Protected endpoints require:

```http
Authorization: Bearer change-me-local-token
```

`GET /health` and `GET /openapi.json` are unauthenticated.

## Database

Set `DATABASE_URL` in `.env` to an administrative database on the same Postgres server, or set `APP_DATABASE_URL` directly to the application database. If only `DATABASE_URL` is present, the app derives `finance_data_api` from it.

```bash
npm run db:create
npm run db:migrate
npm run db:seed
```

The news source seed catalogs all 27 consolidated research sources and leaves
every source disabled by default. Enable only reviewed sources through the API.
Guardian requires `GUARDIAN_API_KEY`; sources whose credentials are unavailable
fail independently without blocking other sources.

Run due sources or target one source:

```bash
npm run news:collect
npm run news:collect -- --source bloomberg-economics
npm run news -- sources
```

An external cron can call `POST /v1/news-collection-runs` in `due` mode. Every
collection is hard-limited to the latest 24 hours. A missing or stale watermark
never causes an older backfill. See [NEWS_INGESTION.md](NEWS_INGESTION.md) for
rollout thresholds and controlled-source validation.

Reset local database objects:

```bash
npm run db:reset
npm run db:migrate
npm run db:seed
```

At runtime, `src/server.ts` connects to PostgreSQL when `APP_DATABASE_URL` or `DATABASE_URL` is configured. The in-memory store remains available for tests and explicit no-database development.

## Validation

```bash
npm run typecheck
npm test
npm run validate
```

## Important MVP Boundaries

- The API returns factual and mechanically derived data only.
- Portfolio positions are derived from operations.
- Existing portfolios start from an explicit opening state and `reliableFrom` boundary.
- Assets are identified by normalized `market + symbol`; custody is modeled separately.
- Imported operations are idempotent within source and brokerage-account scope.
- Historical valuations expose the price and FX observations used.
- Analytics separate external contributions and withdrawals from mechanically
  derived gain or loss and expose completeness diagnostics.
- Portfolio evolution and benchmark comparison are normalized factual series,
  not TWR, MWR, IRR, alpha, attribution, or advice.
- Reconciliation detects discrepancies but never changes ledger facts automatically.
- Processing state is separate from factual records.
- No recommendation, scoring, risk interpretation, or news impact analysis belongs in this service.
