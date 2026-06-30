# News Ingestion Operations

## Collection boundary

Every run has a fixed UTC upper bound and a hard lower bound exactly 24 hours
earlier. A first run starts at that lower bound. A stale watermark plus overlap
is clamped to it, and an explicit older backfill is rejected.

The default overlap is two hours. RSS, Atom, and RDF feeds are filtered locally.
Guardian receives the same interval through native date parameters. The
successful watermark advances only after all accepted items persist.

## Source candidate filters

Source config may include optional `candidateFilters.whitelist` and
`candidateFilters.blacklist` arrays. When no filters are configured, collection
behavior is unchanged and every structurally valid candidate continues through
deduplication and persistence.

Filters match normalized candidate `title` and `category` values. Supported
rule modes are `contains`, `word`, `exact`, and `regex`; prefer non-regex modes
unless a source needs a pattern that plain terms cannot express. Regex rules
are validated when the source is saved or seeded.

Whitelist rules take precedence over blacklist rules. A candidate matching a
whitelist rule is accepted even if it also matches a blacklist rule. A
candidate matching only a blacklist rule is rejected and the collection run
records a bounded diagnostic.

Noisy-source blacklist example:

```json
{
  "candidateFilters": {
    "blacklist": [
      { "value": "opinion", "mode": "exact", "target": "category", "reason": "exclude commentary feed items" }
    ]
  }
}
```

Curated-source whitelist plus blacklist example:

```json
{
  "candidateFilters": {
    "whitelist": [
      { "value": "central bank", "mode": "contains", "target": "title" }
    ],
    "blacklist": [
      { "value": "opinion", "mode": "exact", "target": "category" }
    ]
  }
}
```

Regex escape-hatch example:

```json
{
  "candidateFilters": {
    "blacklist": [
      { "value": "\\bcrypto(?:currency)?\\b", "mode": "regex", "target": "title" }
    ]
  }
}
```

## Scheduling

Call `POST /v1/news-collection-runs` with `{"mode":"due"}` from an external
cron every 10 to 15 minutes. The service leases each source independently and
runs sources with bounded concurrency. Start with global concurrency `3`.

After source items are persisted, the scheduled collection agent must treat
story grouping as a post-ingestion phase:

1. Group exact duplicate coverage by normalized canonical URL.
2. For remaining same-day items from different sources, run conservative
   semantic duplicate checks using title, summary/body when available, key
   entities, event type, and factual outcome.
3. Preserve every `news_items` record and link duplicates as story mentions;
   never delete or overwrite a publisher item because it was also seen
   elsewhere.
4. Do not mutate an existing story classification only because a new duplicate
   mention arrived. Record the mention as additional evidence and mark the story
   for review only when the new mention is materially richer or creates a
   classification conflict.

Use `GET /v1/news-stories` to inspect clustered stories. Responses include the
primary mention, bounded `alsoSeenIn` source mentions, grouping provenance, and
effective classification source.

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
