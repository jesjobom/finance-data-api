CREATE TABLE IF NOT EXISTS news_classifications (
  id TEXT PRIMARY KEY,
  news_id TEXT NOT NULL REFERENCES news_items(id) ON DELETE CASCADE,
  classifier_id TEXT NOT NULL,
  classifier_type TEXT NOT NULL CHECK (classifier_type IN ('agent', 'rule', 'human')),
  classifier_version TEXT NOT NULL,
  external_run_id TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  importance TEXT NOT NULL CHECK (importance IN ('low', 'medium', 'high', 'critical')),
  scope TEXT NOT NULL CHECK (scope IN ('global', 'country', 'sector', 'company', 'mixed')),
  horizon TEXT NOT NULL CHECK (horizon IN ('immediate', 'short_term', 'medium_term', 'long_term')),
  overall_confidence NUMERIC(5,4) NOT NULL CHECK (overall_confidence BETWEEN 0 AND 1),
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  countries JSONB NOT NULL DEFAULT '[]'::jsonb,
  currencies JSONB NOT NULL DEFAULT '[]'::jsonb,
  sectors JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  supersedes_classification_id TEXT REFERENCES news_classifications(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(news_id, classifier_id, external_run_id),
  UNIQUE(supersedes_classification_id)
);

CREATE TABLE IF NOT EXISTS news_classification_targets (
  id TEXT PRIMARY KEY,
  classification_id TEXT NOT NULL REFERENCES news_classifications(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('country', 'currency', 'sector', 'company', 'investment')),
  target_key TEXT NOT NULL,
  investment_id TEXT REFERENCES investments(id),
  company_name TEXT,
  market TEXT,
  symbol TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('positive', 'negative', 'mixed', 'neutral', 'uncertain')),
  magnitude TEXT NOT NULL CHECK (magnitude IN ('low', 'medium', 'high', 'unknown')),
  confidence NUMERIC(5,4) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  rationale TEXT NOT NULL,
  evidence_keys JSONB NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE(classification_id, target_type, target_key)
);

CREATE TABLE IF NOT EXISTS news_classification_reviews (
  id TEXT PRIMARY KEY,
  classification_id TEXT NOT NULL REFERENCES news_classifications(id) ON DELETE CASCADE,
  reviewer TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected', 'needs_revision')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS news_classification_target_resolutions (
  id TEXT PRIMARY KEY,
  target_id TEXT NOT NULL REFERENCES news_classification_targets(id) ON DELETE CASCADE,
  investment_id TEXT NOT NULL REFERENCES investments(id),
  actor TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_news_classifications_news_current
  ON news_classifications(news_id, classifier_id, created_at DESC, id);
CREATE INDEX IF NOT EXISTS idx_news_classifications_importance
  ON news_classifications(importance, overall_confidence DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_classifications_countries ON news_classifications USING GIN(countries);
CREATE INDEX IF NOT EXISTS idx_news_classifications_currencies ON news_classifications USING GIN(currencies);
CREATE INDEX IF NOT EXISTS idx_news_classifications_sectors ON news_classifications USING GIN(sectors);
CREATE INDEX IF NOT EXISTS idx_news_classification_targets_lookup
  ON news_classification_targets(target_type, target_key, direction, confidence DESC);
CREATE INDEX IF NOT EXISTS idx_news_classification_targets_investment
  ON news_classification_targets(investment_id) WHERE investment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_news_classification_reviews_lookup
  ON news_classification_reviews(classification_id, created_at DESC, id);
