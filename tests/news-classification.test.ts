import { describe, expect, it } from "vitest";
import { createInvestment, testApp } from "./helpers.js";

async function createNews(ctx: ReturnType<typeof testApp>) {
  const response = await ctx.app.inject({
    method: "POST", url: "/v1/news", headers: ctx.auth,
    payload: { source: "integration", title: "Central bank changes rates", summary: "Rates affect banks and CAD.", publishedAt: "2026-06-21T12:00:00.000Z" }
  });
  return response.json();
}

function classification(overrides: Record<string, unknown> = {}) {
  return {
    classifierId: "macro-agent", classifierType: "agent", classifierVersion: "gpt-test-v1",
    externalRunId: "run-1", importance: "high", scope: "mixed", horizon: "short_term",
    overallConfidence: 0.85, tags: ["interest-rates"], countries: ["CA"], currencies: ["CAD"],
    sectors: [{ taxonomy: "internal", code: "banks", label: "Banks" }],
    evidence: [{ key: "rate-change", sourceField: "summary", explanation: "The summary names rates and banks." }],
    targets: [{
      targetType: "currency", targetKey: "CAD", direction: "positive", magnitude: "medium",
      confidence: 0.7, rationale: "Higher rates may support the currency.", evidenceKeys: ["rate-change"]
    }],
    ...overrides
  };
}

describe("news classification API", () => {
  it("creates, replays, conflicts, filters, supersedes, and preserves parallel classifiers", async () => {
    const ctx = testApp();
    const news = await createNews(ctx);
    const created = await ctx.app.inject({
      method: "POST", url: `/v1/news/${news.id}/classifications`, headers: ctx.auth, payload: classification()
    });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ importResult: "created", importance: "high", currencies: ["CAD"] });

    const replay = await ctx.app.inject({
      method: "POST", url: `/v1/news/${news.id}/classifications`, headers: ctx.auth, payload: classification()
    });
    expect(replay.statusCode).toBe(200);
    expect(replay.json().id).toBe(created.json().id);

    const conflict = await ctx.app.inject({
      method: "POST", url: `/v1/news/${news.id}/classifications`, headers: ctx.auth,
      payload: classification({ importance: "critical" })
    });
    expect(conflict.statusCode).toBe(409);

    const parallel = await ctx.app.inject({
      method: "POST", url: `/v1/news/${news.id}/classifications`, headers: ctx.auth,
      payload: classification({ classifierId: "second-agent", externalRunId: "run-1", importance: "low" })
    });
    expect(parallel.statusCode).toBe(201);

    const successor = await ctx.app.inject({
      method: "POST", url: `/v1/news/${news.id}/classifications`, headers: ctx.auth,
      payload: classification({ externalRunId: "run-2", importance: "critical", supersedesClassificationId: created.json().id })
    });
    expect(successor.statusCode).toBe(201);

    const current = await ctx.app.inject({
      method: "GET", url: `/v1/news/${news.id}/classifications?current=true`, headers: ctx.auth
    });
    expect(current.json().map((item: any) => item.id).sort()).toEqual([parallel.json().id, successor.json().id].sort());

    const filtered = await ctx.app.inject({
      method: "GET", url: "/v1/news-classifications?importance=critical&currency=CAD&current=true", headers: ctx.auth
    });
    expect(filtered.json()).toMatchObject({ total: 1 });
  });

  it("reviews classifications, resolves company targets, and keeps queues independent", async () => {
    const ctx = testApp();
    const investment = await createInvestment(ctx);
    const news = await createNews(ctx);
    const unclassified = await ctx.app.inject({
      method: "GET", url: "/v1/news-classification-queue?kind=unclassified", headers: ctx.auth
    });
    expect(unclassified.json().map((item: any) => item.id)).toContain(news.id);

    const created = await ctx.app.inject({
      method: "POST", url: `/v1/news/${news.id}/classifications`, headers: ctx.auth,
      payload: classification({
        targets: [{
          targetType: "company", companyName: "Apple Inc.", market: "NASDAQ", symbol: "AAPL",
          direction: "uncertain", magnitude: "unknown", confidence: 0.4,
          rationale: "Indirect macro impact.", evidenceKeys: ["rate-change"]
        }]
      })
    });
    const target = created.json().targets[0];
    const review = await ctx.app.inject({
      method: "POST", url: `/v1/news-classifications/${created.json().id}/reviews`, headers: ctx.auth,
      payload: { reviewer: "jj", decision: "needs_revision", notes: "Check company linkage" }
    });
    expect(review.statusCode).toBe(201);
    const resolution = await ctx.app.inject({
      method: "POST", url: `/v1/news-classification-targets/${target.id}/resolutions`, headers: ctx.auth,
      payload: { investmentId: investment.id, actor: "jj", reason: "Matched market and symbol" }
    });
    expect(resolution.statusCode).toBe(201);

    const revisionQueue = await ctx.app.inject({
      method: "GET", url: "/v1/news-classification-queue?kind=needs_revision", headers: ctx.auth
    });
    expect(revisionQueue.json()[0].id).toBe(created.json().id);

    await ctx.app.inject({
      method: "POST", url: `/v1/news/${news.id}/process`, headers: ctx.auth, payload: { actor: "reader" }
    });
    const current = await ctx.app.inject({ method: "GET", url: `/v1/news-classifications/${created.json().id}`, headers: ctx.auth });
    expect(current.json().effectiveReview.decision).toBe("needs_revision");
    expect(current.json().targets[0].companyName).toBe("Apple Inc.");
    const pending = await ctx.app.inject({ method: "GET", url: "/v1/pending-work", headers: ctx.auth });
    expect(pending.json().news).toEqual([]);
    expect(pending.json().classificationReviews).toContainEqual({ id: created.json().id, newsId: news.id });
  });

  it("keeps duplicate news groups out of the unclassified queue after one item is classified", async () => {
    const ctx = testApp();
    const first = await ctx.app.inject({
      method: "POST", url: "/v1/news", headers: ctx.auth,
      payload: {
        source: "source-a", title: "Same macro event", publishedAt: "2026-06-21T12:00:00.000Z",
        duplicateGroup: "macro-event-1"
      }
    });
    const duplicate = await ctx.app.inject({
      method: "POST", url: "/v1/news", headers: ctx.auth,
      payload: {
        source: "source-b", title: "Same macro event republished", publishedAt: "2026-06-21T13:00:00.000Z",
        duplicateGroup: "macro-event-1"
      }
    });
    await ctx.app.inject({
      method: "POST", url: `/v1/news/${first.json().id}/classifications`, headers: ctx.auth, payload: classification()
    });

    const queue = await ctx.app.inject({
      method: "GET", url: "/v1/news-classification-queue?kind=unclassified", headers: ctx.auth
    });

    expect(queue.json().map((item: any) => item.id)).not.toContain(duplicate.json().id);
  });

  it("rejects recommendation-like and unknown fields", async () => {
    const ctx = testApp();
    const news = await createNews(ctx);
    const response = await ctx.app.inject({
      method: "POST", url: `/v1/news/${news.id}/classifications`, headers: ctx.auth,
      payload: classification({ recommendation: "buy" })
    });
    expect(response.statusCode).toBe(400);
  });
});
