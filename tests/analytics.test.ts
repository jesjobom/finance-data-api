import { describe, expect, it } from "vitest";
import { createInvestment, testApp } from "./helpers.js";

async function setReliableFrom(ctx: ReturnType<typeof testApp>, date = "2026-01-01") {
  await ctx.app.inject({
    method: "PATCH", url: "/v1/portfolios/portfolio_default", headers: ctx.auth,
    payload: { reliableFrom: date, baseCurrency: "USD" }
  });
}

describe("portfolio analytics queries", () => {
  it("separates cumulative external flows from mechanically derived gain or loss", async () => {
    const ctx = testApp();
    await setReliableFrom(ctx);
    const investment = await createInvestment(ctx);
    await ctx.app.inject({
      method: "POST", url: "/v1/opening-positions", headers: ctx.auth,
      payload: {
        portfolioId: "portfolio_default", accountId: "account_default", investmentId: investment.id,
        effectiveDate: "2026-01-01", quantity: 10, currency: "USD", totalCost: 100
      }
    });
    for (const payload of [
      { investmentId: investment.id, type: "contribution", effectiveDate: "2026-02-01", quantity: 2, price: 10, currency: "USD" },
      { investmentId: investment.id, type: "withdrawal", effectiveDate: "2026-03-01", quantity: 1, price: 12, currency: "USD" }
    ]) {
      const response = await ctx.app.inject({ method: "POST", url: "/v1/operations", headers: ctx.auth, payload });
      expect(response.statusCode).toBe(201);
    }
    for (const payload of [
      { investmentId: investment.id, effectiveAt: "2026-01-01T12:00:00.000Z", value: 10, currency: "USD", source: "manual" },
      { investmentId: investment.id, effectiveAt: "2026-03-31T12:00:00.000Z", value: 12, currency: "USD", source: "manual" }
    ]) {
      await ctx.app.inject({ method: "POST", url: "/v1/prices", headers: ctx.auth, payload });
    }

    const response = await ctx.app.inject({
      method: "GET", url: "/v1/portfolio/analytics/2026-03-31?source=manual", headers: ctx.auth
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      marketValue: 132,
      openingValue: 100,
      contributions: 20,
      withdrawals: 12,
      netExternalFlow: 8,
      gainLoss: 24,
      formula: "gainLoss = marketValue - openingValue - netExternalFlow",
      completeness: { status: "partial" }
    });
    expect(response.json().completeness.diagnostics).toHaveLength(2);
    expect(response.json().flowProvenance.map((item: any) => item.type)).toEqual(["contribution", "withdrawal"]);

    const evolution = await ctx.app.inject({
      method: "GET",
      url: "/v1/portfolio/evolution?from=2026-01-01&to=2026-03-31&interval=monthly&source=manual",
      headers: ctx.auth
    });
    expect(evolution.json().samples.at(-1).analytics).toMatchObject({
      marketValue: 132, netExternalFlow: 8, gainLoss: 24
    });
  });

  it("returns asset allocation weights and deterministic top-N concentration", async () => {
    const ctx = testApp();
    await setReliableFrom(ctx);
    const apple = await createInvestment(ctx);
    const microsoft = await createInvestment(ctx, { symbol: "MSFT", name: "Microsoft" });
    const secondAccount = await ctx.app.inject({
      method: "POST", url: "/v1/accounts", headers: ctx.auth,
      payload: { name: "Second Account" }
    });
    for (const [investment, quantity, value] of [[apple, 2, 100], [microsoft, 1, 100]] as const) {
      await ctx.app.inject({
        method: "POST", url: "/v1/opening-positions", headers: ctx.auth,
        payload: {
          investmentId: investment.id, effectiveDate: "2026-01-01",
          quantity, currency: "USD", totalCost: quantity * value
        }
      });
      await ctx.app.inject({
        method: "POST", url: "/v1/prices", headers: ctx.auth,
        payload: {
          investmentId: investment.id, effectiveAt: "2026-06-20T12:00:00.000Z",
          value, currency: "USD", source: "manual"
        }
      });
    }
    await ctx.app.inject({
      method: "POST", url: "/v1/opening-positions", headers: ctx.auth,
      payload: {
        accountId: secondAccount.json().id, investmentId: apple.id,
        effectiveDate: "2026-01-01", quantity: 1, currency: "USD", totalCost: 100
      }
    });

    const allocation = await ctx.app.inject({
      method: "GET", url: "/v1/allocations/asset/value/2026-06-20?source=manual", headers: ctx.auth
    });
    expect(allocation.json()).toEqual([
      { key: apple.id, baseCurrency: "USD", baseValue: 300, weight: 0.75, unavailablePositions: [], completeness: { status: "complete", diagnostics: [] } },
      { key: microsoft.id, baseCurrency: "USD", baseValue: 100, weight: 0.25, unavailablePositions: [], completeness: { status: "complete", diagnostics: [] } }
    ].sort((a, b) => a.key.localeCompare(b.key)));

    const concentration = await ctx.app.inject({
      method: "GET", url: "/v1/portfolio/concentration/2026-06-20?top=1&source=manual", headers: ctx.auth
    });
    expect(concentration.json()).toMatchObject({
      totalMarketValue: 400,
      topWeight: 0.75,
      remainingWeight: 0.25,
      completeness: { status: "complete", diagnostics: [] }
    });
    expect(concentration.json().assets).toHaveLength(1);
    expect(concentration.json().assets[0]).toMatchObject({ investment: { id: apple.id }, baseValue: 300 });
  });

  it("normalizes portfolio and benchmark evolution at the first common complete sample", async () => {
    const ctx = testApp();
    await setReliableFrom(ctx);
    const investment = await createInvestment(ctx);
    await ctx.app.inject({
      method: "POST", url: "/v1/opening-positions", headers: ctx.auth,
      payload: { investmentId: investment.id, effectiveDate: "2026-01-01", quantity: 10, currency: "USD", totalCost: 100 }
    });
    for (const payload of [
      { investmentId: investment.id, effectiveAt: "2026-01-01T12:00:00.000Z", value: 10, currency: "USD", source: "manual" },
      { investmentId: investment.id, effectiveAt: "2026-03-31T12:00:00.000Z", value: 12, currency: "USD", source: "manual" }
    ]) await ctx.app.inject({ method: "POST", url: "/v1/prices", headers: ctx.auth, payload });

    const benchmark = await ctx.app.inject({
      method: "POST", url: "/v1/benchmarks", headers: ctx.auth,
      payload: { name: "Example Index", symbol: "EXI", currency: "USD", source: "manual" }
    });
    for (const payload of [
      { benchmarkId: benchmark.json().id, effectiveAt: "2026-01-01T12:00:00.000Z", value: 100, currency: "USD", source: "manual" },
      { benchmarkId: benchmark.json().id, effectiveAt: "2026-03-31T12:00:00.000Z", value: 110, currency: "USD", source: "manual" }
    ]) await ctx.app.inject({ method: "POST", url: "/v1/benchmark-observations", headers: ctx.auth, payload });

    const response = await ctx.app.inject({
      method: "GET",
      url: `/v1/portfolio/evolution?from=2026-01-01&to=2026-03-31&interval=monthly&source=manual&benchmarkId=${benchmark.json().id}`,
      headers: ctx.auth
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().normalizationDate).toBe("2026-01-01");
    expect(response.json().samples.map((sample: any) => sample.date)).toEqual([
      "2026-01-01", "2026-01-31", "2026-02-28", "2026-03-31"
    ]);
    expect(response.json().samples[0]).toMatchObject({ portfolioIndex: 100, benchmarkIndex: 100 });
    expect(response.json().samples[1].benchmark).toMatchObject({ diagnostic: { type: "benchmark" } });
    expect(response.json().samples[1].benchmarkIndex).toBeUndefined();
    expect(response.json().samples.at(-1)).toMatchObject({ portfolioIndex: 120, benchmarkIndex: 110 });
  });

  it("uses stable asset ordering for equal concentration values and handles an empty portfolio", async () => {
    const empty = testApp();
    const emptyResponse = await empty.app.inject({
      method: "GET", url: "/v1/portfolio/concentration/2026-06-20?top=5", headers: empty.auth
    });
    expect(emptyResponse.json()).toMatchObject({
      totalMarketValue: 0, assets: [],
      completeness: { status: "complete", diagnostics: [] }
    });
    expect(emptyResponse.json().topWeight).toBeUndefined();
    expect(emptyResponse.json().remainingWeight).toBeUndefined();

    const ctx = testApp();
    await setReliableFrom(ctx);
    const microsoft = await createInvestment(ctx, { symbol: "MSFT", name: "Microsoft" });
    const apple = await createInvestment(ctx, { symbol: "AAPL2", name: "Apple Two" });
    for (const investment of [microsoft, apple]) {
      await ctx.app.inject({
        method: "POST", url: "/v1/opening-positions", headers: ctx.auth,
        payload: { investmentId: investment.id, effectiveDate: "2026-01-01", quantity: 1, currency: "USD", totalCost: 100 }
      });
      await ctx.app.inject({
        method: "POST", url: "/v1/prices", headers: ctx.auth,
        payload: { investmentId: investment.id, effectiveAt: "2026-06-20T12:00:00.000Z", value: 100, currency: "USD", source: "manual" }
      });
    }
    const tied = await ctx.app.inject({
      method: "GET", url: "/v1/portfolio/concentration/2026-06-20?top=1&source=manual", headers: ctx.auth
    });
    expect(tied.json().assets[0].investment.symbol).toBe("AAPL2");
  });

  it("keeps gain or loss unavailable when required historical market data is missing", async () => {
    const ctx = testApp();
    await setReliableFrom(ctx);
    const investment = await createInvestment(ctx);
    await ctx.app.inject({
      method: "POST", url: "/v1/opening-positions", headers: ctx.auth,
      payload: { investmentId: investment.id, effectiveDate: "2026-01-01", quantity: 1, currency: "USD" }
    });
    const response = await ctx.app.inject({
      method: "GET", url: "/v1/portfolio/analytics/2026-06-20", headers: ctx.auth
    });
    expect(response.json()).toMatchObject({ completeness: { status: "unavailable" } });
    expect(response.json().gainLoss).toBeUndefined();
    expect(response.json().completeness.diagnostics[0]).toMatchObject({ type: "price", investmentId: investment.id });

    const allocation = await ctx.app.inject({
      method: "GET", url: "/v1/allocations/asset/value/2026-06-20", headers: ctx.auth
    });
    expect(allocation.json()[0]).toMatchObject({
      key: investment.id,
      completeness: { status: "unavailable" }
    });
    expect(allocation.json()[0].weight).toBeUndefined();

    const invalidTop = await ctx.app.inject({
      method: "GET", url: "/v1/portfolio/concentration/2026-06-20?top=0", headers: ctx.auth
    });
    expect(invalidTop.statusCode).toBe(400);

    const beforeReliable = await ctx.app.inject({
      method: "GET",
      url: "/v1/portfolio/evolution?from=2025-12-31&to=2026-01-31&interval=monthly",
      headers: ctx.auth
    });
    expect(beforeReliable.statusCode).toBe(400);
    expect(beforeReliable.json().error.details).toMatchObject({ reliableFrom: "2026-01-01" });
  });
});
