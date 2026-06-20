import { describe, expect, it } from "vitest";
import { createInvestment, testApp } from "./helpers.js";

describe("portfolio reconciliation", () => {
  it("reports matches, discrepancies, unresolved lines, and ledger-only positions without mutation", async () => {
    const ctx = testApp();
    const apple = await createInvestment(ctx);
    const microsoft = await createInvestment(ctx, { symbol: "MSFT", name: "Microsoft" });
    for (const investment of [apple, microsoft]) {
      await ctx.app.inject({
        method: "POST", url: "/v1/operations", headers: ctx.auth,
        payload: { investmentId: investment.id, type: "buy", effectiveDate: "2026-01-01", quantity: 5, price: 100, currency: "USD" }
      });
    }

    const statement = await ctx.app.inject({
      method: "POST", url: "/v1/statements", headers: ctx.auth,
      payload: {
        accountId: "account_default", statementDate: "2026-06-20", source: "broker", externalId: "statement-1",
        lines: [
          { investmentId: apple.id, symbol: "AAPL", market: "NASDAQ", quantity: 4, currency: "CAD", totalCost: 400 },
          { symbol: "UNKNOWN", market: "NASDAQ", quantity: 3, currency: "USD" }
        ]
      }
    });
    expect(statement.statusCode).toBe(201);
    expect(statement.json().lines[1].resolved).toBe(false);

    const reconciliation = await ctx.app.inject({
      method: "POST", url: `/v1/statements/${statement.json().id}/reconcile`, headers: ctx.auth
    });
    expect(reconciliation.statusCode).toBe(201);
    expect(reconciliation.json().status).toBe("discrepancies");
    expect(reconciliation.json().results.map((item: any) => item.status).sort()).toEqual(
      ["discrepancy", "ledger_only", "unresolved"].sort()
    );
    expect(reconciliation.json().results.find((item: any) => item.investmentId === apple.id)).toMatchObject({
      costAvailable: false, marketValueAvailable: false
    });

    const portfolio = await ctx.app.inject({ method: "GET", url: "/v1/portfolio/current", headers: ctx.auth });
    expect(portfolio.json().map((item: any) => item.quantity)).toEqual([5, 5]);
  });

  it("creates statements idempotently by source, account, and external id", async () => {
    const ctx = testApp();
    const investment = await createInvestment(ctx);
    const payload = {
      accountId: "account_default", statementDate: "2026-06-20", source: "broker", externalId: "same",
      lines: [{ investmentId: investment.id, symbol: "AAPL", market: "NASDAQ", quantity: 1, currency: "USD" }]
    };
    const first = await ctx.app.inject({ method: "POST", url: "/v1/statements", headers: ctx.auth, payload });
    const second = await ctx.app.inject({ method: "POST", url: "/v1/statements", headers: ctx.auth, payload });
    expect(second.json().id).toBe(first.json().id);
    const list = await ctx.app.inject({ method: "GET", url: "/v1/statements", headers: ctx.auth });
    expect(list.json()).toHaveLength(1);
  });

  it("compares statement cost in another currency with FX provenance", async () => {
    const ctx = testApp();
    const investment = await createInvestment(ctx);
    await ctx.app.inject({
      method: "POST", url: "/v1/operations", headers: ctx.auth,
      payload: { investmentId: investment.id, type: "buy", effectiveDate: "2026-01-01", quantity: 5, price: 100, currency: "USD" }
    });
    const fx = await ctx.app.inject({
      method: "POST", url: "/v1/fx-rates", headers: ctx.auth,
      payload: { baseCurrency: "USD", quoteCurrency: "CAD", effectiveAt: "2026-06-20T12:00:00.000Z", rate: 1.25, source: "manual" }
    });
    const price = await ctx.app.inject({
      method: "POST", url: "/v1/prices", headers: ctx.auth,
      payload: { investmentId: investment.id, effectiveAt: "2026-06-20T12:00:00.000Z", value: 120, currency: "USD", source: "manual" }
    });
    const statement = await ctx.app.inject({
      method: "POST", url: "/v1/statements", headers: ctx.auth,
      payload: {
        accountId: "account_default", statementDate: "2026-06-20", source: "broker",
        lines: [{ investmentId: investment.id, symbol: "AAPL", market: "NASDAQ", quantity: 5, currency: "CAD", totalCost: 625, marketValue: 750 }]
      }
    });
    const reconciliation = await ctx.app.inject({
      method: "POST", url: `/v1/statements/${statement.json().id}/reconcile`, headers: ctx.auth
    });
    expect(reconciliation.json().results[0]).toMatchObject({
      status: "matched", costAvailable: true, calculatedCost: 625, costDifference: 0,
      costFxObservationId: fx.json().id, costFxInverted: false,
      marketValueAvailable: true, calculatedMarketValue: 750, marketValueDifference: 0,
      valuePriceObservationId: price.json().id, valueFxObservationId: fx.json().id
    });
  });
});
