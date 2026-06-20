ALTER TABLE investments ADD COLUMN IF NOT EXISTS isin TEXT;
UPDATE investments SET market = 'UNKNOWN' WHERE market IS NULL OR btrim(market) = '';
UPDATE investments SET market = upper(market), symbol = upper(symbol);
ALTER TABLE investments ALTER COLUMN market SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_investments_market_symbol_active
  ON investments (upper(market), upper(symbol)) WHERE active;

CREATE TABLE IF NOT EXISTS portfolios (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  base_currency CHAR(3) NOT NULL,
  reliable_from DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO portfolios(id, name, base_currency, reliable_from)
VALUES('portfolio_default', 'Default Portfolio', 'USD', DATE '1900-01-01')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS brokerage_accounts (
  id TEXT PRIMARY KEY,
  portfolio_id TEXT NOT NULL REFERENCES portfolios(id),
  name TEXT NOT NULL,
  institution TEXT,
  external_id TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_brokerage_account_external
  ON brokerage_accounts(portfolio_id, external_id) WHERE external_id IS NOT NULL;

INSERT INTO brokerage_accounts(id, portfolio_id, name)
VALUES('account_default', 'portfolio_default', 'Default Account')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE operations ADD COLUMN IF NOT EXISTS account_id TEXT REFERENCES brokerage_accounts(id);
UPDATE operations SET account_id = 'account_default' WHERE account_id IS NULL;
ALTER TABLE operations ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE operations ADD COLUMN IF NOT EXISTS destination_account_id TEXT REFERENCES brokerage_accounts(id);
ALTER TABLE operations ADD COLUMN IF NOT EXISTS ratio NUMERIC(24, 10);
ALTER TABLE operations ADD COLUMN IF NOT EXISTS bonus_total_cost NUMERIC(24, 8);
ALTER TABLE operations ADD COLUMN IF NOT EXISTS fractional_quantity NUMERIC(24, 8);
ALTER TABLE operations ADD COLUMN IF NOT EXISTS import_source TEXT;
ALTER TABLE operations ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE operations ADD COLUMN IF NOT EXISTS payload_hash TEXT;
ALTER TABLE operations ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE operations DROP CONSTRAINT IF EXISTS operations_type_check;
ALTER TABLE operations ADD CONSTRAINT operations_type_check CHECK (
  type IN ('buy', 'sell', 'contribution', 'withdrawal', 'dividend', 'yield', 'redemption', 'maturity',
           'transfer', 'split', 'reverse_split', 'bonus')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_operations_import_identity
  ON operations(import_source, account_id, external_id)
  WHERE import_source IS NOT NULL AND external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS opening_positions (
  id TEXT PRIMARY KEY,
  portfolio_id TEXT NOT NULL REFERENCES portfolios(id),
  account_id TEXT NOT NULL REFERENCES brokerage_accounts(id),
  investment_id TEXT NOT NULL REFERENCES investments(id),
  effective_date DATE NOT NULL,
  quantity NUMERIC(24, 8) NOT NULL CHECK (quantity > 0),
  currency CHAR(3) NOT NULL,
  total_cost NUMERIC(24, 8),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(portfolio_id, account_id, investment_id)
);

CREATE TABLE IF NOT EXISTS operation_revisions (
  id TEXT PRIMARY KEY,
  operation_id TEXT NOT NULL REFERENCES operations(id),
  version INTEGER NOT NULL,
  actor TEXT NOT NULL,
  reason TEXT NOT NULL,
  before_data JSONB NOT NULL,
  after_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(operation_id, version)
);

CREATE TABLE IF NOT EXISTS price_observations (
  id TEXT PRIMARY KEY,
  investment_id TEXT NOT NULL REFERENCES investments(id),
  effective_at TIMESTAMPTZ NOT NULL,
  value NUMERIC(24, 8) NOT NULL CHECK (value >= 0),
  currency CHAR(3) NOT NULL,
  source TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_prices_asset_effective ON price_observations(investment_id, effective_at DESC, source);

CREATE TABLE IF NOT EXISTS fx_rates (
  id TEXT PRIMARY KEY,
  base_currency CHAR(3) NOT NULL,
  quote_currency CHAR(3) NOT NULL,
  effective_at TIMESTAMPTZ NOT NULL,
  rate NUMERIC(24, 10) NOT NULL CHECK (rate > 0),
  source TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK(base_currency <> quote_currency)
);
CREATE INDEX IF NOT EXISTS idx_fx_pair_effective ON fx_rates(base_currency, quote_currency, effective_at DESC, source);

CREATE TABLE IF NOT EXISTS portfolio_statements (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES brokerage_accounts(id),
  statement_date DATE NOT NULL,
  source TEXT NOT NULL,
  external_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_statement_external
  ON portfolio_statements(source, account_id, external_id) WHERE external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS statement_lines (
  id TEXT PRIMARY KEY,
  statement_id TEXT NOT NULL REFERENCES portfolio_statements(id) ON DELETE CASCADE,
  investment_id TEXT REFERENCES investments(id),
  market TEXT,
  symbol TEXT NOT NULL,
  quantity NUMERIC(24, 8) NOT NULL CHECK (quantity >= 0),
  currency CHAR(3) NOT NULL,
  total_cost NUMERIC(24, 8),
  market_value NUMERIC(24, 8),
  resolved BOOLEAN NOT NULL
);

CREATE TABLE IF NOT EXISTS reconciliations (
  id TEXT PRIMARY KEY,
  statement_id TEXT NOT NULL REFERENCES portfolio_statements(id),
  account_id TEXT NOT NULL REFERENCES brokerage_accounts(id),
  statement_date DATE NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('matched', 'discrepancies')),
  results JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reconciliations_account_date ON reconciliations(account_id, statement_date, created_at);
