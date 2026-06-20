import { describe, expect, it } from "vitest";
import { createInvestment, testApp } from "./helpers.js";

describe("portfolio accounting foundations", () => {
  it("starts from an explicit reliable opening state and rejects earlier history", async () => {
    const ctx = testApp();
    const investment = await createInvestment(ctx);
    await ctx.app.inject({
      method: "PATCH", url: "/v1/portfolios/portfolio_default", headers: ctx.auth,
      payload: { baseCurrency: "CAD", reliableFrom: "2026-01-01" }
    });
    const opening = await ctx.app.inject({
      method: "POST", url: "/v1/opening-positions", headers: ctx.auth,
      payload: {
        investmentId: investment.id, accountId: "account_default", portfolioId: "portfolio_default",
        effectiveDate: "2026-01-01", quantity: 10, currency: "USD", totalCost: 800
      }
    });
    expect(opening.statusCode).toBe(201);

    const current = await ctx.app.inject({ method: "GET", url: "/v1/portfolio/current", headers: ctx.auth });
    expect(current.json()[0]).toMatchObject({
      quantity: 10, totalCost: 800, costStatus: "known", reliableFrom: "2026-01-01", reliable: true
    });

    const earlier = await ctx.app.inject({ method: "GET", url: "/v1/portfolio/at/2025-12-31", headers: ctx.auth });
    expect(earlier.statusCode).toBe(400);
    expect(earlier.json().error.details.reliableFrom).toBe("2026-01-01");
  });

  it("preserves portfolio quantity and cost through split, transfer, and bonus", async () => {
    const ctx = testApp();
    const investment = await createInvestment(ctx);
    const account = await ctx.app.inject({
      method: "POST", url: "/v1/accounts", headers: ctx.auth,
      payload: { name: "Second Broker", institution: "Example" }
    });
    const destinationAccountId = account.json().id;

    for (const payload of [
      { investmentId: investment.id, accountId: "account_default", type: "buy", effectiveDate: "2026-01-01", quantity: 10, price: 100, currency: "USD" },
      { investmentId: investment.id, accountId: "account_default", type: "split", effectiveDate: "2026-02-01", quantity: 0, ratio: 2, currency: "USD" },
      { investmentId: investment.id, accountId: "account_default", destinationAccountId, type: "transfer", effectiveDate: "2026-03-01", quantity: 8, currency: "USD" },
      { investmentId: investment.id, accountId: destinationAccountId, type: "bonus", effectiveDate: "2026-04-01", quantity: 2, bonusTotalCost: 50, currency: "USD" }
    ]) {
      const response = await ctx.app.inject({ method: "POST", url: "/v1/operations", headers: ctx.auth, payload });
      expect(response.statusCode).toBe(201);
    }

    const positions = (await ctx.app.inject({ method: "GET", url: "/v1/portfolio/current", headers: ctx.auth })).json();
    expect(positions).toHaveLength(2);
    expect(positions.find((item: any) => item.accountId === "account_default")).toMatchObject({ quantity: 12, totalCost: 600 });
    expect(positions.find((item: any) => item.accountId === destinationAccountId)).toMatchObject({ quantity: 10, totalCost: 450 });
    expect(positions.reduce((sum: number, item: any) => sum + item.quantity, 0)).toBe(22);
    expect(positions.reduce((sum: number, item: any) => sum + item.totalCost, 0)).toBe(1050);
  });

  it("imports idempotently and audits factual revisions", async () => {
    const ctx = testApp();
    const investment = await createInvestment(ctx);
    const payload = {
      investmentId: investment.id, accountId: "account_default", type: "buy", effectiveDate: "2026-01-01",
      quantity: 2, price: 100, currency: "USD", importSource: "broker-file", externalId: "row-42"
    };
    const created = await ctx.app.inject({ method: "POST", url: "/v1/operations", headers: ctx.auth, payload });
    const replayed = await ctx.app.inject({ method: "POST", url: "/v1/operations", headers: ctx.auth, payload });
    expect(created.statusCode).toBe(201);
    expect(replayed.statusCode).toBe(200);
    expect(replayed.json()).toMatchObject({ id: created.json().id, importResult: "replayed" });

    const conflict = await ctx.app.inject({
      method: "POST", url: "/v1/operations", headers: ctx.auth, payload: { ...payload, quantity: 3 }
    });
    expect(conflict.statusCode).toBe(409);

    const secondAccount = await ctx.app.inject({
      method: "POST", url: "/v1/accounts", headers: ctx.auth, payload: { name: "Second import scope" }
    });
    const crossScope = await ctx.app.inject({
      method: "POST", url: "/v1/operations", headers: ctx.auth,
      payload: { ...payload, accountId: secondAccount.json().id }
    });
    expect(crossScope.statusCode).toBe(201);
    expect(crossScope.json().id).not.toBe(created.json().id);

    const revised = await ctx.app.inject({
      method: "PATCH", url: `/v1/operations/${created.json().id}`, headers: ctx.auth,
      payload: { actor: "jj", reason: "Corrected statement quantity", expectedVersion: 1, changes: { quantity: 3 } }
    });
    expect(revised.statusCode).toBe(200);
    expect(revised.json()).toMatchObject({ quantity: 3, version: 2 });

    const revisions = await ctx.app.inject({
      method: "GET", url: `/v1/operations/${created.json().id}/revisions`, headers: ctx.auth
    });
    expect(revisions.json()[0]).toMatchObject({
      actor: "jj", reason: "Corrected statement quantity", version: 2
    });
    expect(revisions.json()[0].before.quantity).toBe(2);
    expect(revisions.json()[0].after.quantity).toBe(3);

    const stale = await ctx.app.inject({
      method: "PATCH", url: `/v1/operations/${created.json().id}`, headers: ctx.auth,
      payload: { actor: "jj", reason: "stale", expectedVersion: 1, changes: { quantity: 4 } }
    });
    expect(stale.statusCode).toBe(409);
  });

  it("handles reverse splits, explicit zero-cost bonuses, and rejects invalid transfers", async () => {
    const ctx = testApp();
    const investment = await createInvestment(ctx);
    await ctx.app.inject({
      method: "POST", url: "/v1/operations", headers: ctx.auth,
      payload: { investmentId: investment.id, type: "buy", effectiveDate: "2026-01-01", quantity: 100, price: 10, currency: "USD" }
    });
    const reverseSplit = await ctx.app.inject({
      method: "POST", url: "/v1/operations", headers: ctx.auth,
      payload: { investmentId: investment.id, type: "reverse_split", effectiveDate: "2026-02-01", quantity: 0, ratio: 0.1, currency: "USD" }
    });
    const bonus = await ctx.app.inject({
      method: "POST", url: "/v1/operations", headers: ctx.auth,
      payload: { investmentId: investment.id, type: "bonus", effectiveDate: "2026-03-01", quantity: 2, bonusTotalCost: 0, currency: "USD" }
    });
    expect(reverseSplit.statusCode).toBe(201);
    expect(bonus.statusCode).toBe(201);
    const current = await ctx.app.inject({ method: "GET", url: "/v1/portfolio/current", headers: ctx.auth });
    expect(current.json()[0]).toMatchObject({ quantity: 12, totalCost: 1000 });

    const invalid = await ctx.app.inject({
      method: "POST", url: "/v1/operations", headers: ctx.auth,
      payload: {
        investmentId: investment.id, accountId: "account_default", destinationAccountId: "account_default",
        type: "transfer", effectiveDate: "2026-04-01", quantity: 1, currency: "USD"
      }
    });
    expect(invalid.statusCode).toBe(400);
  });
});
