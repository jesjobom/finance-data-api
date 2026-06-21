CREATE TABLE IF NOT EXISTS news_sources (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  adapter_type TEXT NOT NULL CHECK (adapter_type IN ('rss', 'guardian', 'alpha_vantage', 'gdelt', 'commercial')),
  endpoint TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  priority TEXT NOT NULL CHECK (priority IN ('core', 'supporting', 'optional', 'fallback', 'paid_core')),
  editorial_type TEXT NOT NULL CHECK (editorial_type IN ('news', 'official_analysis', 'research', 'opinion', 'advocacy', 'aggregator')),
  language TEXT,
  region TEXT,
  access_tier TEXT NOT NULL,
  polling_interval_minutes INTEGER NOT NULL CHECK (polling_interval_minutes BETWEEN 5 AND 1440),
  stale_after_minutes INTEGER NOT NULL CHECK (stale_after_minutes BETWEEN 5 AND 43200),
  overlap_minutes INTEGER NOT NULL CHECK (overlap_minutes BETWEEN 0 AND 1440),
  request_timeout_ms INTEGER NOT NULL CHECK (request_timeout_ms BETWEEN 1000 AND 120000),
  max_response_bytes INTEGER NOT NULL CHECK (max_response_bytes BETWEEN 1024 AND 20000000),
  max_concurrency INTEGER NOT NULL CHECK (max_concurrency BETWEEN 1 AND 10),
  secret_ref TEXT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  disabled_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS news_source_state (
  source_id TEXT PRIMARY KEY REFERENCES news_sources(id) ON DELETE CASCADE,
  watermark TIMESTAMPTZ,
  etag TEXT,
  last_modified TEXT,
  latest_item_at TIMESTAMPTZ,
  last_attempt_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  next_poll_at TIMESTAMPTZ,
  lease_owner TEXT,
  lease_expires_at TIMESTAMPTZ,
  last_error_code TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS news_collection_runs (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES news_sources(id),
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('scheduled', 'manual', 'cli')),
  window_from TIMESTAMPTZ NOT NULL,
  window_to TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'no_change', 'partial', 'failed', 'rate_limited', 'skipped')),
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  counts JSONB NOT NULL DEFAULT '{}'::jsonb,
  diagnostics JSONB NOT NULL DEFAULT '[]'::jsonb,
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (window_to >= window_from),
  CHECK (window_to - window_from <= INTERVAL '24 hours')
);

ALTER TABLE news_items ADD COLUMN IF NOT EXISTS source_id TEXT REFERENCES news_sources(id);
ALTER TABLE news_items ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE news_items ADD COLUMN IF NOT EXISTS canonical_url TEXT;
ALTER TABLE news_items ADD COLUMN IF NOT EXISTS retrieved_at TIMESTAMPTZ;
ALTER TABLE news_items ADD COLUMN IF NOT EXISTS language TEXT;
ALTER TABLE news_items ADD COLUMN IF NOT EXISTS region TEXT;
ALTER TABLE news_items ADD COLUMN IF NOT EXISTS topic_tags JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE news_items ADD COLUMN IF NOT EXISTS raw_hash TEXT;
ALTER TABLE news_items ADD COLUMN IF NOT EXISTS duplicate_group TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_news_source_external_id
  ON news_items(source_id, external_id) WHERE source_id IS NOT NULL AND external_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_news_source_canonical_url
  ON news_items(source_id, canonical_url) WHERE source_id IS NOT NULL AND external_id IS NULL AND canonical_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_news_sources_due ON news_sources(enabled, priority);
CREATE INDEX IF NOT EXISTS idx_news_source_state_due ON news_source_state(next_poll_at, lease_expires_at);
CREATE INDEX IF NOT EXISTS idx_news_collection_runs_lookup ON news_collection_runs(source_id, started_at DESC, status);
CREATE INDEX IF NOT EXISTS idx_news_duplicate_group ON news_items(duplicate_group) WHERE duplicate_group IS NOT NULL;
