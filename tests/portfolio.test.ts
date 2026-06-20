import { describe, expect, it } from "vitest";
import { createInvestment, testApp } from "./helpers.js";

describe("deterministic portfolio queries", () => {
  it("consolidates current and historical positions from operations", async () => {
    const ctx = testApp();
    const investment = await createInvestment(ctx);

    for (const payload of [
      { investmentId: investment.id, type: "buy", effectiveDate: "2026-01-01", quantity: 10, price: 100, currency: "USD" },
      { investmentId: investment.id, type: "sell", effectiveDate: "2026-02-01", quantity: 3, price: 110, currency: "USD" },
      { investmentId: investment.id, type: "dividend", effectiveDate: "2026-02-10", quantity: 0, price: 2, currency: "USD" }
    ]) {
      const response = await ctx.app.inject({ method: "POST", url: "/v1/operations", headers: ctx.auth, payload });
      expect(response.statusCode).toBe(201);
    }

    const current = await ctx.app.inject({ method: "GET", url: "/v1/portfolio/current", headers: ctx.auth });
    expect(current.json()[0].quantity).toBe(7);

    const historical = await ctx.app.inject({ method: "GET", url: "/v1/portfolio/at/2026-01-15", headers: ctx.auth });
    expect(historical.json()[0].quantity).toBe(10);
  });

  it("groups allocation by currency", async () => {
    const ctx = testApp();
    const usd = await createInvestment(ctx, { symbol: "AAPL", currency: "USD" });
    const brl = await createInvestment(ctx, { symbol: "HGLG11", name: "CSHG Logistica", assetClass: "fii", currency: "BRL", market: "B3", country: "BR" });

    await ctx.app.inject({ method: "POST", url: "/v1/operations", headers: ctx.auth, payload: { investmentId: usd.id, type: "buy", effectiveDate: "2026-01-01", quantity: 5, currency: "USD" } });
    await ctx.app.inject({ method: "POST", url: "/v1/operations", headers: ctx.auth, payload: { investmentId: brl.id, type: "buy", effectiveDate: "2026-01-02", quantity: 8, currency: "BRL" } });

    const response = await ctx.app.inject({ method: "GET", url: "/v1/allocations/currency", headers: ctx.auth });
    expect(response.json()).toEqual([{ key: "BRL", quantity: 8 }, { key: "USD", quantity: 5 }]);
  });

  it("groups broker allocation from custody accounts instead of the legacy asset field", async () => {
    const ctx = testApp();
    const investment = await createInvestment(ctx, { broker: "legacy-asset-broker" });
    const account = await ctx.app.inject({
      method: "POST", url: "/v1/accounts", headers: ctx.auth,
      payload: { name: "Primary Account", institution: "Actual Custodian" }
    });
    await ctx.app.inject({
      method: "POST", url: "/v1/operations", headers: ctx.auth,
      payload: {
        investmentId: investment.id, accountId: account.json().id, type: "buy",
        effectiveDate: "2026-01-01", quantity: 3, currency: "USD"
      }
    });

    const response = await ctx.app.inject({
      method: "GET", url: "/v1/allocations/broker", headers: ctx.auth
    });
    expect(response.json()).toEqual([{ key: "Actual Custodian", quantity: 3 }]);
  });

  it("compares real and virtual portfolios without recommendations", async () => {
    const ctx = testApp();
    const investment = await createInvestment(ctx);
    await ctx.app.inject({ method: "POST", url: "/v1/operations", headers: ctx.auth, payload: { investmentId: investment.id, type: "buy", effectiveDate: "2026-01-01", quantity: 5, currency: "USD" } });
    const portfolio = await ctx.app.inject({ method: "POST", url: "/v1/virtual-portfolios", headers: ctx.auth, payload: { name: "Target" } });
    await ctx.app.inject({ method: "POST", url: `/v1/virtual-portfolios/${portfolio.json().id}/positions`, headers: ctx.auth, payload: { investmentId: investment.id, quantity: 8 } });

    const response = await ctx.app.inject({ method: "GET", url: `/v1/virtual-portfolios/${portfolio.json().id}/compare`, headers: ctx.auth });
    expect(response.json()[0]).toMatchObject({ realQuantity: 5, virtualQuantity: 8, quantityDifference: 3 });
    expect(JSON.stringify(response.json())).not.toMatch(/recommend|score|impact|risk/i);
  });
});
