import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("accounting migration contract", () => {
  it("contains additive backfill, identity, idempotency, audit, market data, and reconciliation structures", async () => {
    const sql = await readFile(new URL("../migrations/002_portfolio_accounting_foundations.sql", import.meta.url), "utf8");
    for (const fragment of [
      "portfolio_default", "account_default", "opening_positions", "operation_revisions",
      "uq_operations_import_identity", "price_observations", "fx_rates",
      "portfolio_statements", "statement_lines", "reconciliations",
      "uq_investments_market_symbol_active"
    ]) expect(sql).toContain(fragment);
  });

  it("adds immutable benchmark observations for analytics", async () => {
    const sql = await readFile(new URL("../migrations/003_portfolio_analytics.sql", import.meta.url), "utf8");
    expect(sql).toContain("benchmark_observations");
    expect(sql).toContain("idx_benchmark_observations_lookup");
    expect(sql).toContain("CHECK (value > 0)");
  });

  it("adds news source, state, run, lease, provenance, and 24-hour constraints", async () => {
    const sql = await readFile(new URL("../migrations/004_news_ingestion.sql", import.meta.url), "utf8");
    for (const fragment of [
      "news_sources", "news_source_state", "news_collection_runs", "lease_expires_at",
      "source_id", "external_id", "canonical_url", "retrieved_at", "duplicate_group",
      "INTERVAL '24 hours'", "uq_news_source_external_id"
    ]) expect(sql).toContain(fragment);
  });

  it("adds immutable news classifications, targets, reviews, and resolutions", async () => {
    const sql = await readFile(new URL("../migrations/005_news_classification.sql", import.meta.url), "utf8");
    for (const fragment of [
      "news_classifications", "news_classification_targets", "news_classification_reviews",
      "news_classification_target_resolutions", "overall_confidence", "external_run_id",
      "supersedes_classification_id", "idx_news_classification_targets_lookup"
    ]) expect(sql).toContain(fragment);
  });
});
