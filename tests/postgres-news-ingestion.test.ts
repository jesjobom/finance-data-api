import { randomUUID } from "node:crypto";
import pg from "pg";
import { describe, expect, it } from "vitest";
import { newsSourceCreateSchema } from "../src/domain.js";
import { NewsCollectionService } from "../src/news-collector.js";
import { PostgresFinanceStore } from "../src/postgres-store.js";

const adminUrl = process.env.DATABASE_URL;
const integration = adminUrl ? it : it.skip;

describe("PostgreSQL news ingestion persistence", () => {
  integration("persists sources, collection state, runs, and idempotent news", async () => {
    const databaseName = `finance_news_test_${randomUUID().replaceAll("-", "")}`;
    const admin = new pg.Client({ connectionString: adminUrl });
    await admin.connect();
    const testUrl = new URL(adminUrl!);
    testUrl.pathname = `/${databaseName}`;
    try {
      await admin.query(`CREATE DATABASE "${databaseName}"`);
      let store = await PostgresFinanceStore.connect(testUrl.toString());
      const source = await store.createNewsSource(newsSourceCreateSchema.parse({
        slug: "persistence-feed", name: "Persistence Feed", adapterType: "rss",
        endpoint: "https://news.example.com/feed.xml", enabled: true, priority: "core",
        editorialType: "news", accessTier: "free", config: {}
      }));
      const xml = `<rss><channel><item><guid>persist-1</guid><title>Persisted</title>
        <link>https://news.example.com/persisted</link><pubDate>Sun, 21 Jun 2026 11:00:00 GMT</pubDate></item></channel></rss>`;
      await store.setNewsSourceState(source.id, { watermark: "2026-06-19T12:00:00.000Z" });
      const collector = new NewsCollectionService(store, {
        now: () => "2026-06-21T12:00:00.000Z",
        fetchImpl: (async () => new Response(xml, { headers: { "content-type": "application/rss+xml" } })) as typeof fetch
      });
      const run = await collector.collectSource(source.id, { trigger: "manual" });
      expect("status" in run && run.status).toBe("success");
      expect("diagnostics" in run && run.diagnostics).toEqual([
        "collection window clamped to the latest 24 hours; older gap is unrecoverable"
      ]);
      const largeBody = "internal-content ".repeat(32_000);
      await store.upsertCollectedNews({
        source: source.name, sourceId: source.id, externalId: "large-body", title: "Large body fixture",
        body: largeBody, publishedAt: "2026-06-21T10:00:00.000Z", retrievedAt: "2026-06-21T12:00:00.000Z",
        topicTags: ["Economia", "Orçamento Federal"], rawHash: "large-body-hash",
        duplicateGroup: "large-body-group", relatedInvestmentIds: []
      });
      await store.close();

      store = await PostgresFinanceStore.connect(testUrl.toString());
      expect(store.getNewsSource(source.id).slug).toBe("persistence-feed");
      expect(store.getNewsSourceState(source.id).watermark).toBe("2026-06-21T12:00:00.000Z");
      expect(store.listNews()).toHaveLength(2);
      expect(store.listNews().find((item) => item.externalId === "large-body")?.body).toHaveLength(largeBody.length);
      expect(store.listNews().find((item) => item.externalId === "large-body")?.topicTags)
        .toEqual(["Economia", "Orçamento Federal"]);
      expect(store.listNewsCollectionRuns({ sourceId: source.id })).toEqual([
        expect.objectContaining({
          diagnostics: ["collection window clamped to the latest 24 hours; older gap is unrecoverable"]
        })
      ]);
      await store.close();
    } finally {
      await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
      await admin.end();
    }
  }, 30_000);
});
