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
