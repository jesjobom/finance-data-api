# News Ingestion Operations

## Collection boundary

Every run has a fixed UTC upper bound and a hard lower bound exactly 24 hours
earlier. A first run starts at that lower bound. A stale watermark plus overlap
is clamped to it, and an explicit older backfill is rejected.

The default overlap is two hours. RSS, Atom, and RDF feeds are filtered locally.
Guardian receives the same interval through native date parameters. The
successful watermark advances only after all accepted items persist.

## Scheduling

Call `POST /v1/news-collection-runs` with `{"mode":"due"}` from an external
cron every 10 to 15 minutes. The service leases each source independently and
runs sources with bounded concurrency. Start with global concurrency `3`.

Operational rollout thresholds:

- source failures do not stop sibling sources;
- three consecutive failures require investigation;
- HTTP 429 uses source-local backoff and must not cause global retries;
- breaking-news feeds use a default stale threshold of 24 hours;
- lower-cadence official analysis uses a source-specific threshold up to 30 days;
- unexpected response growth must remain below each source's configured byte
  ceiling;
- sustained article-body failures should disable `fetchArticleContent` for that
  source without disabling headline ingestion.

Alpha Vantage, GDELT, and commercial adapters remain disabled until quota,
coverage, rate-limit, and access benchmarks are approved.

## Controlled validation

On 2026-06-21 UTC, before the catalog default was changed to disabled, the
collector ran in memory against the seven core RSS candidates with article
retrieval disabled for the access check. All seven completed successfully:

- 235 feed items fetched;
- 12 items accepted inside the fixed 24-hour window;
- zero malformed/future candidates rejected;
- no source-level failures.

Guardian was separately validated with its public test credential:

- two results fetched and accepted;
- native `from-date` and `to-date` matched the fixed 24-hour window;
- full `bodyText` ingestion succeeded.

The controlled runs wrote no production records. Automated PostgreSQL tests
cover migrations, source state, collection runs, idempotent news persistence,
reload behavior, and a large inline article-body fixture.

The production seed now catalogs all consolidated sources with `enabled=false`.
The validation above remains access evidence, not an activation instruction.
