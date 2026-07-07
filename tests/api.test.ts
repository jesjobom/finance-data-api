import { describe, expect, it } from "vitest";
import { createInvestment, testApp } from "./helpers.js";

describe("api contract basics", () => {
  it("allows unauthenticated healthcheck", async () => {
    const { app } = testApp();
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });

  it("rejects protected endpoints without bearer token", async () => {
    const { app } = testApp();
    const response = await app.inject({ method: "GET", url: "/v1/investments" });
    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe("authentication_error");
  });

  it("returns structured validation errors", async () => {
    const { app, auth } = testApp();
    const response = await app.inject({
      method: "POST",
      url: "/v1/investments",
      headers: auth,
      payload: { symbol: "AAPL" }
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("validation_error");
  });

  it("creates and deactivates investments without deleting them", async () => {
    const ctx = testApp();
    const investment = await createInvestment(ctx);
    expect(investment.id).toMatch(/^inv_/);
    expect(investment.active).toBe(true);

    const deactivate = await ctx.app.inject({
      method: "POST",
      url: `/v1/investments/${investment.id}/deactivate`,
      headers: ctx.auth
    });
    expect(deactivate.statusCode).toBe(200);
    expect(deactivate.json().active).toBe(false);

    const get = await ctx.app.inject({ method: "GET", url: `/v1/investments/${investment.id}`, headers: ctx.auth });
    expect(get.statusCode).toBe(200);
    expect(get.json().active).toBe(false);
  });

  it("replays imported operations idempotently and rejects conflicting replays", async () => {
    const ctx = testApp();
    const investment = await createInvestment(ctx);
    const payload = {
      investmentId: investment.id,
      type: "buy",
      effectiveDate: "2026-01-01",
      quantity: 3,
      price: 100,
      currency: "USD",
      importSource: "broker-csv",
      externalId: "trade-1"
    };

    const created = await ctx.app.inject({ method: "POST", url: "/v1/operations", headers: ctx.auth, payload });
    const replayed = await ctx.app.inject({ method: "POST", url: "/v1/operations", headers: ctx.auth, payload });
    const conflict = await ctx.app.inject({
      method: "POST",
      url: "/v1/operations",
      headers: ctx.auth,
      payload: { ...payload, quantity: 4 }
    });

    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ importResult: "created" });
    expect(replayed.statusCode).toBe(200);
    expect(replayed.json()).toMatchObject({ id: created.json().id, importResult: "replayed" });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json().error.code).toBe("conflict");
  });

  it("patches news sources partially without dropping required persisted fields", async () => {
    const ctx = testApp();
    const created = await ctx.app.inject({
      method: "POST",
      url: "/v1/news-sources",
      headers: ctx.auth,
      payload: {
        slug: "daily-wire",
        name: "Daily Wire",
        adapterType: "rss",
        endpoint: "https://news.example.com/feed.xml",
        enabled: true
      }
    });

    const patched = await ctx.app.inject({
      method: "PATCH",
      url: `/v1/news-sources/${created.json().id}`,
      headers: ctx.auth,
      payload: { enabled: false, disabledReason: "maintenance" }
    });

    expect(created.statusCode).toBe(201);
    expect(patched.statusCode).toBe(200);
    expect(patched.json()).toMatchObject({
      id: created.json().id,
      slug: "daily-wire",
      endpoint: "https://news.example.com/feed.xml",
      enabled: false,
      disabledReason: "maintenance"
    });
  });

  it("accepts the documented changes cursor parameter", async () => {
    const ctx = testApp();
    await createInvestment(ctx);
    const first = await ctx.app.inject({ method: "GET", url: "/v1/changes", headers: ctx.auth });
    const next = await ctx.app.inject({
      method: "GET",
      url: `/v1/changes?cursor=${encodeURIComponent(first.json().cursor)}`,
      headers: ctx.auth
    });
    expect(next.statusCode).toBe(200);
    expect(next.json().changes).toEqual([]);
  });
});
