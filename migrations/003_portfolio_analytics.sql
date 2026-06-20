CREATE TABLE IF NOT EXISTS benchmark_observations (
  id TEXT PRIMARY KEY,
  benchmark_id TEXT NOT NULL REFERENCES benchmarks(id),
  effective_at TIMESTAMPTZ NOT NULL,
  value NUMERIC(24, 8) NOT NULL CHECK (value > 0),
  currency CHAR(3) NOT NULL,
  source TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_benchmark_observations_lookup
  ON benchmark_observations(benchmark_id, effective_at DESC, source, id);
