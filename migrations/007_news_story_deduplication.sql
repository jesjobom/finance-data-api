CREATE TABLE IF NOT EXISTS news_story_clusters (
  id TEXT PRIMARY KEY,
  publication_date DATE NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  primary_news_id TEXT NOT NULL REFERENCES news_items(id) ON DELETE RESTRICT,
  canonical_url TEXT,
  semantic_key TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'needs_review', 'conflicting_classifications')),
  review_reason TEXT,
  classification_source JSONB NOT NULL DEFAULT '{"type":"none"}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS news_story_mentions (
  id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL REFERENCES news_story_clusters(id) ON DELETE CASCADE,
  news_id TEXT NOT NULL REFERENCES news_items(id) ON DELETE CASCADE,
  source_id TEXT REFERENCES news_sources(id),
  match_reason TEXT NOT NULL CHECK (match_reason IN ('canonical_url', 'semantic', 'manual', 'backfill')),
  confidence NUMERIC(6, 5) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  diagnostics JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(news_id)
);

CREATE INDEX IF NOT EXISTS idx_news_story_clusters_date ON news_story_clusters(publication_date, status);
CREATE INDEX IF NOT EXISTS idx_news_story_clusters_canonical ON news_story_clusters(canonical_url) WHERE canonical_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_news_story_mentions_story ON news_story_mentions(story_id, is_primary DESC);
CREATE INDEX IF NOT EXISTS idx_news_story_mentions_news ON news_story_mentions(news_id);
