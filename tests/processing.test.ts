import { describe, expect, it } from "vitest";
import { createInvestment, testApp } from "./helpers.js";

describe("processing control", () => {
  it("marks news processed without changing factual fields", async () => {
    const ctx = testApp();
    const investment = await createInvestment(ctx);
    const newsResponse = await ctx.app.inject({
      method: "POST",
      url: "/v1/news",
      headers: ctx.auth,
      payload: {
        source: "manual",
        title: "Company announces results",
        publishedAt: "2026-06-16T10:00:00.000Z",
        relatedInvestmentIds: [investment.id]
      }
    });
    const before = newsResponse.json();

    const processed = await ctx.app.inject({
      method: "POST",
      url: `/v1/news/${before.id}/process`,
      headers: ctx.auth,
      payload: { actor: "finance-agent", notes: "read" }
    });

    expect(processed.statusCode).toBe(200);
    expect(processed.json()).toMatchObject({
      id: before.id,
      title: before.title,
      source: before.source,
      processedBy: "finance-agent"
    });

    const pending = await ctx.app.inject({ method: "GET", url: "/v1/pending-work", headers: ctx.auth });
    expect(pending.json().news).toEqual([]);
  });

  it("marks operations reviewed without changing operation facts", async () => {
    const ctx = testApp();
    const investment = await createInvestment(ctx);
    const operation = await ctx.app.inject({
      method: "POST",
      url: "/v1/operations",
      headers: ctx.auth,
      payload: { investmentId: investment.id, type: "buy", effectiveDate: "2026-01-01", quantity: 1, currency: "USD" }
    });

    const reviewed = await ctx.app.inject({
      method: "POST",
      url: `/v1/operations/${operation.json().id}/review`,
      headers: ctx.auth,
      payload: { actor: "jj" }
    });

    expect(reviewed.json()).toMatchObject({
      id: operation.json().id,
      investmentId: investment.id,
      type: "buy",
      quantity: 1,
      reviewedBy: "jj"
    });
  });
});
