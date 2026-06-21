import { describe, expect, it } from "vitest";
import { newsClassificationCreateSchema, type NewsClassificationCreateInput } from "../src/domain.js";
import { FinanceStore } from "../src/store.js";

function createNews(store: FinanceStore, title = "Central bank changes rates") {
  return store.createNews({
    source: "unit",
    title,
    publishedAt: "2026-06-21T12:00:00.000Z",
    topicTags: [],
    relatedInvestmentIds: []
  });
}

function createInvestment(store: FinanceStore) {
  return store.createInvestment({
    symbol: "AAPL",
    name: "Apple Inc.",
    assetClass: "stock",
    currency: "USD",
    market: "NASDAQ",
    country: "US",
    active: true
  });
}

function classification(overrides: Record<string, unknown> = {}): NewsClassificationCreateInput {
  return newsClassificationCreateSchema.parse({
    classifierId: "macro-agent",
    classifierType: "agent",
    classifierVersion: "v1",
    externalRunId: "run-1",
    importance: "medium",
    scope: "mixed",
    horizon: "short_term",
    overallConfidence: 0.75,
    tags: ["rates"],
    countries: ["CA"],
    currencies: ["CAD"],
    sectors: [{ taxonomy: "gics", code: "financials" }],
    evidence: [{ key: "headline", sourceField: "title", explanation: "Headline names rates." }],
    targets: [{
      targetType: "currency",
      targetKey: "CAD",
      direction: "uncertain",
      magnitude: "unknown",
      confidence: 0.4,
      rationale: "Direction is unclear.",
      evidenceKeys: ["headline"]
    }],
    ...overrides
  });
}

describe("store edge cases", () => {
  it("prevents superseding classifications across news or classifier lineages", () => {
    const store = new FinanceStore();
    const firstNews = createNews(store, "First");
    const secondNews = createNews(store, "Second");
    const original = store.createNewsClassification(firstNews.id, classification()).classification;

    expect(() => store.createNewsClassification(secondNews.id, classification({
      externalRunId: "run-2",
      supersedesClassificationId: original.id
    }))).toThrow(/same news and classifier/);

    expect(() => store.createNewsClassification(firstNews.id, classification({
      classifierId: "other-agent",
      externalRunId: "run-2",
      supersedesClassificationId: original.id
    }))).toThrow(/same news and classifier/);
  });

  it("allows only one direct successor for a classification", () => {
    const store = new FinanceStore();
    const news = createNews(store);
    const original = store.createNewsClassification(news.id, classification()).classification;
    store.createNewsClassification(news.id, classification({ externalRunId: "run-2", supersedesClassificationId: original.id }));

    expect(() => store.createNewsClassification(news.id, classification({
      externalRunId: "run-3",
      supersedesClassificationId: original.id
    }))).toThrow(/already superseded/);
  });

  it("applies current filters after supersession and keeps historical queries available", () => {
    const store = new FinanceStore();
    const news = createNews(store);
    const original = store.createNewsClassification(news.id, classification({ importance: "low" })).classification;
    const successor = store.createNewsClassification(news.id, classification({
      externalRunId: "run-2",
      importance: "critical",
      supersedesClassificationId: original.id
    })).classification;

    expect(store.listNewsClassifications({ current: true }).items.map((item) => item.id)).toEqual([successor.id]);
    expect(store.listNewsClassifications({ current: false, limit: 10 }).items.map((item) => item.id).sort()).toEqual([original.id, successor.id].sort());
  });

  it("rejects investment targets and resolutions that point to missing investments", () => {
    const store = new FinanceStore();
    const news = createNews(store);

    expect(() => store.createNewsClassification(news.id, classification({
      targets: [{
        targetType: "investment",
        investmentId: "inv_missing",
        direction: "negative",
        magnitude: "high",
        confidence: 0.8,
        rationale: "Known investment target.",
        evidenceKeys: ["headline"]
      }]
    }))).toThrow(/investment/);

    const created = store.createNewsClassification(news.id, classification({
      targets: [{
        targetType: "company",
        companyName: "Apple Inc.",
        market: "NASDAQ",
        symbol: "AAPL",
        direction: "uncertain",
        magnitude: "unknown",
        confidence: 0.4,
        rationale: "Company may be affected.",
        evidenceKeys: ["headline"]
      }]
    })).classification;

    expect(() => store.resolveClassificationTarget(created.targets[0].id, {
      investmentId: "inv_missing",
      actor: "unit-test",
      reason: "Missing investment"
    })).toThrow(/investment/);
  });

  it("allows resolving only company targets", () => {
    const store = new FinanceStore();
    const investment = createInvestment(store);
    const news = createNews(store);
    const created = store.createNewsClassification(news.id, classification()).classification;

    expect(() => store.resolveClassificationTarget(created.targets[0].id, {
      investmentId: investment.id,
      actor: "unit-test",
      reason: "Currency target is not a company"
    })).toThrow(/Only company targets/);
  });

  it("orders effective review by append order and separates review queues", () => {
    const store = new FinanceStore();
    const news = createNews(store);
    const created = store.createNewsClassification(news.id, classification()).classification;
    store.addClassificationReview(created.id, { reviewer: "reviewer", decision: "needs_revision", notes: "First pass" });
    store.addClassificationReview(created.id, { reviewer: "reviewer", decision: "approved", notes: "Second pass" });

    expect(store.effectiveClassificationReview(created.id)?.decision).toBe("approved");
    expect(store.classificationQueue("needs_revision")).toEqual([]);
    expect(store.classificationQueue("unreviewed")).toEqual([]);
  });
});
