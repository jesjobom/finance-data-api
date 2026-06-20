import { describe, expect, it } from "vitest";
import { createInvestment, testApp } from "./helpers.js";

describe("historical market data and valuation", () => {
  it("values in base currency with price and inverse FX provenance", async () => {
    const ctx = testApp();
    const investment = await createInvestment(ctx);
    await ctx.app.inject({
      method: "PATCH", url: "/v1/portfolios/portfolio_default", headers: ctx.auth,
      payload: { baseCurrency: "CAD" }
    });
    await ctx.app.inject({
      method: "POST", url: "/v1/operations", headers: ctx.auth,
      payload: { investmentId: investment.id, type: "buy", effectiveDate: "2026-01-01", quantity: 2, price: 80, currency: "USD" }
    });
    const price = await ctx.app.inject({
      method: "POST", url: "/v1/prices", headers: ctx.auth,
      payload: { investmentId: investment.id, effectiveAt: "2026-06-19T20:00:00.000Z", value: 100, currency: "USD", source: "manual" }
    });
    const fx = await ctx.app.inject({
      method: "POST", url: "/v1/fx-rates", headers: ctx.auth,
      payload: { baseCurrency: "CAD", quoteCurrency: "USD", effectiveAt: "2026-06-19T20:00:00.000Z", rate: 0.8, source: "manual" }
    });

    const response = await ctx.app.inject({
      method: "GET", url: "/v1/portfolio/value/2026-06-20?source=manual", headers: ctx.auth
    });
    expect(response.json()[0]).toMatchObject({
      valuationStatus: "available", originalValue: 200, baseValue: 250, baseCurrency: "CAD",
      fxInverted: true
    });
    expect(response.json()[0].price.id).toBe(price.json().id);
    expect(response.json()[0].fx.id).toBe(fx.json().id);
    expect(response.json()[0].originalGainLoss).toBe(40);

    const allocation = await ctx.app.inject({
      method: "GET", url: "/v1/allocations/currency/value/2026-06-20?source=manual", headers: ctx.auth
    });
    expect(allocation.json()).toEqual([{
      key: "USD", baseCurrency: "CAD", baseValue: 250, weight: 1, unavailablePositions: [],
      completeness: { status: "complete", diagnostics: [] }
    }]);
  });

  it("returns structured missing historical market data instead of a current quote", async () => {
    const ctx = testApp();
    const investment = await createInvestment(ctx);
    await ctx.app.inject({
      method: "POST", url: "/v1/operations", headers: ctx.auth,
      payload: { investmentId: investment.id, type: "buy", effectiveDate: "2026-01-01", quantity: 1, currency: "USD" }
    });
    const response = await ctx.app.inject({
      method: "GET", url: "/v1/portfolio/value/2026-06-20", headers: ctx.auth
    });
    expect(response.json()[0]).toMatchObject({
      valuationStatus: "unavailable",
      missing: { type: "price", investmentId: investment.id, date: "2026-06-20" }
    });

    await ctx.app.inject({
      method: "POST", url: "/v1/prices", headers: ctx.auth,
      payload: { investmentId: investment.id, effectiveAt: "2026-06-20T12:00:00.000Z", value: 100, currency: "USD", source: "manual" }
    });
    const valuedUnknownCost = await ctx.app.inject({
      method: "GET", url: "/v1/portfolio/value/2026-06-20?source=manual", headers: ctx.auth
    });
    expect(valuedUnknownCost.json()[0]).toMatchObject({
      valuationStatus: "available", originalValue: 100, costStatus: "unknown"
    });
    expect(valuedUnknownCost.json()[0].originalGainLoss).toBeUndefined();
  });
});
