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
});
