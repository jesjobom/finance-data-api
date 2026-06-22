import { randomUUID } from "node:crypto";
import pg from "pg";
import { describe, expect, it } from "vitest";
import { investmentCreateSchema, newsClassificationCreateSchema, newsCreateSchema } from "../src/domain.js";
import { PostgresFinanceStore } from "../src/postgres-store.js";

const adminUrl = process.env.DATABASE_URL;
const integration = adminUrl ? it : it.skip;

describe("PostgreSQL news classification persistence", () => {
  integration("persists replay-safe lineage, targets, reviews, resolutions, and reload", async () => {
    const databaseName = `finance_classification_test_${randomUUID().replaceAll("-", "")}`;
    const admin = new pg.Client({ connectionString: adminUrl });
    await admin.connect();
    const testUrl = new URL(adminUrl!);
    testUrl.pathname = `/${databaseName}`;
    try {
      await admin.query(`CREATE DATABASE "${databaseName}"`);
      let store = await PostgresFinanceStore.connect(testUrl.toString());
      const observer = await PostgresFinanceStore.connect(testUrl.toString());
      const investment = await store.createInvestment({
        ...investmentCreateSchema.parse({
          symbol: "AAPL", name: "Apple Inc.", assetClass: "stock", currency: "USD", market: "NASDAQ"
        }), active: true
      });
      const news = await store.createNews(newsCreateSchema.parse({
        source: "test", title: "Rates change", summary: "Macro event", publishedAt: "2026-06-21T12:00:00.000Z"
      }));
      const input = newsClassificationCreateSchema.parse({
        classifierId: "agent-one", classifierType: "agent", classifierVersion: "v1", externalRunId: "run-1",
        importance: "high", scope: "company", horizon: "short_term", overallConfidence: 0.8,
        evidence: [{ key: "macro", sourceField: "summary", explanation: "Macro event" }],
        targets: [{
          targetType: "company", companyName: "Apple Inc.", market: "NASDAQ", symbol: "AAPL",
          direction: "uncertain", magnitude: "unknown", confidence: 0.5, rationale: "Indirect effect", evidenceKeys: ["macro"]
        }]
      });
      expect((await observer.classificationQueue("unclassified")).map((item) => item.id)).toContain(news.id);
      const created = await observer.createNewsClassification(news.id, input);
      expect((await store.createNewsClassification(news.id, input)).result).toBe("replayed");
      await store.addClassificationReview(created.classification.id, {
        reviewer: "jj", decision: "approved", notes: "Reviewed"
      });
      await store.resolveClassificationTarget(created.classification.targets[0].id, {
        investmentId: investment.id, actor: "jj", reason: "Matched company"
      });
      expect(await observer.classificationQueue("unclassified")).toEqual([]);
      await observer.close();
      await store.close();

      store = await PostgresFinanceStore.connect(testUrl.toString());
      const loaded = await store.getNewsClassification(created.classification.id);
      expect(loaded.targets[0].companyName).toBe("Apple Inc.");
      expect((await store.effectiveClassificationReview(loaded.id))?.decision).toBe("approved");
      expect((await store.listClassificationTargetResolutions(loaded.targets[0].id))[0].investmentId).toBe(investment.id);
      await store.close();
    } finally {
      await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
      await admin.end();
    }
  }, 30_000);
});
