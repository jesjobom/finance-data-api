CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS investments (
  id TEXT PRIMARY KEY DEFAULT ('inv_' || gen_random_uuid()),
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  asset_class TEXT NOT NULL CHECK (asset_class IN ('stock', 'fii', 'etf', 'fixed_income', 'crypto', 'cash', 'other')),
  currency CHAR(3) NOT NULL,
  market TEXT,
  country TEXT,
  broker TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS operations (
  id TEXT PRIMARY KEY DEFAULT ('op_' || gen_random_uuid()),
  investment_id TEXT NOT NULL REFERENCES investments(id),
  type TEXT NOT NULL CHECK (type IN ('buy', 'sell', 'contribution', 'withdrawal', 'dividend', 'yield', 'redemption', 'maturity')),
  effective_date DATE NOT NULL,
  quantity NUMERIC(24, 8) NOT NULL CHECK (quantity >= 0),
  price NUMERIC(24, 8),
  currency CHAR(3) NOT NULL,
  fees NUMERIC(24, 8),
  notes TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS news_items (
  id TEXT PRIMARY KEY DEFAULT ('news_' || gen_random_uuid()),
  source TEXT NOT NULL,
  url TEXT,
  title TEXT NOT NULL,
  summary TEXT,
  body TEXT,
  published_at TIMESTAMPTZ NOT NULL,
  processed_at TIMESTAMPTZ,
  processed_by TEXT,
  processing_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS news_investments (
  news_id TEXT NOT NULL REFERENCES news_items(id) ON DELETE CASCADE,
  investment_id TEXT NOT NULL REFERENCES investments(id),
  PRIMARY KEY (news_id, investment_id)
);

CREATE TABLE IF NOT EXISTS watched_assets (
  id TEXT PRIMARY KEY DEFAULT ('watch_' || gen_random_uuid()),
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  asset_class TEXT NOT NULL CHECK (asset_class IN ('stock', 'fii', 'etf', 'fixed_income', 'crypto', 'cash', 'other')),
  currency CHAR(3) NOT NULL,
  market TEXT,
  country TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS virtual_portfolios (
  id TEXT PRIMARY KEY DEFAULT ('vp_' || gen_random_uuid()),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS virtual_positions (
  id TEXT PRIMARY KEY DEFAULT ('vpos_' || gen_random_uuid()),
  virtual_portfolio_id TEXT NOT NULL REFERENCES virtual_portfolios(id) ON DELETE CASCADE,
  investment_id TEXT NOT NULL REFERENCES investments(id),
  quantity NUMERIC(24, 8) NOT NULL CHECK (quantity >= 0),
  target_weight NUMERIC(8, 6) CHECK (target_weight >= 0 AND target_weight <= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS benchmarks (
  id TEXT PRIMARY KEY DEFAULT ('bench_' || gen_random_uuid()),
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  currency CHAR(3) NOT NULL,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  id TEXT PRIMARY KEY DEFAULT ('snap_' || gen_random_uuid()),
  captured_at TIMESTAMPTZ NOT NULL,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS snapshot_positions (
  snapshot_id TEXT NOT NULL REFERENCES portfolio_snapshots(id) ON DELETE CASCADE,
  investment_id TEXT NOT NULL REFERENCES investments(id),
  quantity NUMERIC(24, 8) NOT NULL CHECK (quantity >= 0),
  currency CHAR(3) NOT NULL,
  PRIMARY KEY (snapshot_id, investment_id)
);

CREATE INDEX IF NOT EXISTS idx_operations_investment_date ON operations(investment_id, effective_date, created_at);
CREATE INDEX IF NOT EXISTS idx_news_published_at ON news_items(published_at);
CREATE INDEX IF NOT EXISTS idx_news_processed_at ON news_items(processed_at);
CREATE INDEX IF NOT EXISTS idx_snapshots_captured_at ON portfolio_snapshots(captured_at DESC);
