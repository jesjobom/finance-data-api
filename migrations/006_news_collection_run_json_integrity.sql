UPDATE news_collection_runs
SET diagnostics = '[]'::jsonb
WHERE jsonb_typeof(diagnostics) <> 'array';

UPDATE news_collection_runs AS run
SET status = 'failed',
    completed_at = COALESCE(completed_at, updated_at),
    diagnostics = diagnostics || '["collection process terminated before the run could be finalized"]'::jsonb,
    error_code = COALESCE(error_code, 'collection_interrupted'),
    updated_at = now()
WHERE status = 'running'
  AND started_at < now() - INTERVAL '15 minutes'
  AND NOT EXISTS (
    SELECT 1
    FROM news_source_state AS state
    WHERE state.source_id = run.source_id
      AND state.lease_expires_at > now()
  );

ALTER TABLE news_collection_runs
  ADD CONSTRAINT news_collection_runs_counts_object
  CHECK (jsonb_typeof(counts) = 'object');

ALTER TABLE news_collection_runs
  ADD CONSTRAINT news_collection_runs_diagnostics_array
  CHECK (jsonb_typeof(diagnostics) = 'array');
