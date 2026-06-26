import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { newsSourceCreateSchema } from "../src/domain.js";
import { BoundedHttpClient, calculateCollectionWindow, NewsCollectionService } from "../src/news-collector.js";
import { loadNewsSourceSeed, seedNewsSources } from "../src/news-source-seed.js";
import { FinanceStore } from "../src/store.js";

const NOW = "2026-06-21T12:00:00.000Z";

function source(overrides: Record<string, unknown> = {}) {
  return newsSourceCreateSchema.parse({
    slug: "example-economy",
    name: "Example Economy",
    adapterType: "rss",
    endpoint: "https://news.example.com/feed.xml",
    enabled: true,
    priority: "core",
    editorialType: "news",
    language: "en",
    region: "global",
    accessTier: "free",
    config: {},
    ...overrides
  });
}

describe("news collection windows", () => {
  it("limits first and stale collections to the latest 24 hours", () => {
    expect(calculateCollectionWindow({ now: NOW, overlapMinutes: 120 }).from).toBe("2026-06-20T12:00:00.000Z");
    const stale = calculateCollectionWindow({ now: NOW, watermark: "2026-06-01T00:00:00.000Z", overlapMinutes: 120 });
    expect(stale.from).toBe("2026-06-20T12:00:00.000Z");
    expect(stale.clamped).toBe(true);
  });

  it("rejects manual backfills older than 24 hours", () => {
    expect(() => calculateCollectionWindow({
      now: NOW, from: "2026-06-19T11:59:59.000Z", to: NOW, overlapMinutes: 120
    })).toThrow(/24 hours/);
  });
});

describe("news collection", () => {
  it("collects RSS idempotently and preserves the fixed window", async () => {
    const store = new FinanceStore();
    const registered = store.createNewsSource(source());
    const xml = `<?xml version="1.0"?><rss><channel>
      <item><guid>story-1</guid><title>Fresh story</title><link>https://news.example.com/a?utm_source=x</link>
      <description><![CDATA[<p>Summary</p>]]></description><pubDate>Sun, 21 Jun 2026 11:00:00 GMT</pubDate></item>
      <item><guid>old</guid><title>Old story</title><pubDate>Fri, 19 Jun 2026 11:00:00 GMT</pubDate></item>
    </channel></rss>`;
    const fetchImpl = async () => new Response(xml, { headers: { "content-type": "application/rss+xml", etag: "\"v1\"" } });
    const collector = new NewsCollectionService(store, { fetchImpl: fetchImpl as typeof fetch, now: () => NOW });

    const first = await collector.collectSource(registered.id, { trigger: "manual" });
    expect("counts" in first && first.counts).toMatchObject({ fetched: 2, accepted: 1, created: 1, rejected: 0 });
    expect(store.listNews()).toHaveLength(1);
    expect(store.listNews()[0]).toMatchObject({
      sourceId: registered.id, externalId: "story-1", canonicalUrl: "https://news.example.com/a", summary: "Summary"
    });

    const second = await collector.collectSource(registered.id, { trigger: "manual" });
    expect("counts" in second && second.counts.duplicates).toBe(1);
    expect(store.listNews()).toHaveLength(1);
  });

  it("deduplicates republishes with a changed external id but the same canonical URL", async () => {
    const store = new FinanceStore();
    const registered = store.createNewsSource(source());
    const fetchImpl = async () => new Response(`<?xml version="1.0"?><rss><channel>
      <item><guid>story-republished</guid><title>Fresh story updated</title><link>https://news.example.com/a?utm_source=newsletter</link>
      <description><![CDATA[<p>Updated summary</p>]]></description><pubDate>Sun, 21 Jun 2026 11:00:00 GMT</pubDate></item>
    </channel></rss>`, { headers: { "content-type": "application/rss+xml" } });
    const collector = new NewsCollectionService(store, { fetchImpl: fetchImpl as typeof fetch, now: () => NOW });

    store.upsertCollectedNews({
      source: registered.name, sourceId: registered.id, externalId: "story-original",
      url: "https://news.example.com/a", canonicalUrl: "https://news.example.com/a",
      title: "Fresh story", publishedAt: "2026-06-21T11:00:00.000Z", retrievedAt: NOW,
      language: "en", region: "global", topicTags: [], rawHash: "original-hash",
      duplicateGroup: "same-story", relatedInvestmentIds: []
    });

    const run = await collector.collectSource(registered.id, { trigger: "manual" });

    expect("counts" in run && run.counts).toMatchObject({ accepted: 1, enriched: 1 });
    expect(store.listNews()).toHaveLength(1);
  });

  it("applies per-source candidate filters with whitelist precedence", async () => {
    const store = new FinanceStore();
    const registered = store.createNewsSource(source({
      config: {
        candidateFilters: {
          whitelist: [{ value: "central bank", mode: "contains", target: "title" }],
          blacklist: [{ value: "opinion", mode: "exact", target: "category" }]
        }
      }
    }));
    const xml = `<?xml version="1.0"?><rss><channel>
      <item><guid>blocked</guid><title>Market opinion column</title><category>opinion</category>
      <pubDate>Sun, 21 Jun 2026 11:00:00 GMT</pubDate></item>
      <item><guid>allowed-by-whitelist</guid><title>Central Bank opinion update</title><category>opinion</category>
      <pubDate>Sun, 21 Jun 2026 11:05:00 GMT</pubDate></item>
      <item><guid>allowed-by-default</guid><title>Inflation data released</title><category>macro</category>
      <pubDate>Sun, 21 Jun 2026 11:10:00 GMT</pubDate></item>
    </channel></rss>`;
    const collector = new NewsCollectionService(store, {
      fetchImpl: (async () => new Response(xml, { headers: { "content-type": "application/rss+xml" } })) as typeof fetch,
      now: () => NOW
    });

    const run = await collector.collectSource(registered.id, { trigger: "manual" });

    expect("status" in run && run.status).toBe("partial");
    expect("counts" in run && run.counts).toMatchObject({ fetched: 3, accepted: 2, created: 2, rejected: 1 });
    expect(store.listNews().map((item) => item.externalId).sort()).toEqual(["allowed-by-default", "allowed-by-whitelist"]);
    expect("diagnostics" in run && run.diagnostics).toContainEqual(expect.stringContaining("candidate filtered by blacklist"));
  });

  it("supports word, regex, disabled, and accent-insensitive filter rules", async () => {
    const store = new FinanceStore();
    const registered = store.createNewsSource(source({
      config: {
        candidateFilters: {
          whitelist: [{ value: "selic", mode: "regex", target: "title" }],
          blacklist: [
            { value: "café", mode: "word", target: "title" },
            { value: "ignored", mode: "contains", target: "title", enabled: false }
          ]
        }
      }
    }));
    const xml = `<?xml version="1.0"?><rss><channel>
      <item><guid>accent-blocked</guid><title>Cafe prices rise</title>
      <pubDate>Sun, 21 Jun 2026 11:00:00 GMT</pubDate></item>
      <item><guid>regex-allowed</guid><title>SELIC cafe update</title>
      <pubDate>Sun, 21 Jun 2026 11:05:00 GMT</pubDate></item>
      <item><guid>disabled-rule</guid><title>Ignored keyword story</title>
      <pubDate>Sun, 21 Jun 2026 11:10:00 GMT</pubDate></item>
    </channel></rss>`;
    const collector = new NewsCollectionService(store, {
      fetchImpl: (async () => new Response(xml, { headers: { "content-type": "application/rss+xml" } })) as typeof fetch,
      now: () => NOW
    });

    const run = await collector.collectSource(registered.id, { trigger: "manual" });

    expect("counts" in run && run.counts).toMatchObject({ accepted: 2, rejected: 1 });
    expect(store.listNews().map((item) => item.externalId).sort()).toEqual(["disabled-rule", "regex-allowed"]);
  });

  it("isolates failures between sources", async () => {
    const store = new FinanceStore();
    const good = store.createNewsSource(source({ slug: "good-source", endpoint: "https://good.example.com/feed.xml" }));
    store.createNewsSource(source({ slug: "bad-source", name: "Bad", endpoint: "https://bad.example.com/feed.xml" }));
    const fetchImpl = async (input: string | URL | Request) => {
      if (String(input).includes("bad.example.com")) return new Response("failure", { status: 500 });
      return new Response(`<rss><channel><item><guid>x</guid><title>X</title><pubDate>Sun, 21 Jun 2026 11:00:00 GMT</pubDate></item></channel></rss>`,
        { headers: { "content-type": "application/rss+xml" } });
    };
    const collector = new NewsCollectionService(store, { fetchImpl: fetchImpl as typeof fetch, now: () => NOW });
    const results = await collector.trigger({ mode: "all_enabled", trigger: "manual", concurrency: 2 });
    expect(results.map((item) => "status" in item && item.status).sort()).toEqual(["failed", "success"]);
    expect(store.listNews()[0].sourceId).toBe(good.id);
  });

  it("stores accessible article content but keeps metadata when article retrieval fails", async () => {
    const store = new FinanceStore();
    const registered = store.createNewsSource(source({ config: { fetchArticleContent: true } }));
    const feed = `<rss><channel>
      <item><guid>with-body</guid><title>With body</title><link>https://news.example.com/body</link><pubDate>Sun, 21 Jun 2026 11:00:00 GMT</pubDate></item>
      <item><guid>without-body</guid><title>Without body</title><link>https://news.example.com/fail</link><pubDate>Sun, 21 Jun 2026 10:00:00 GMT</pubDate></item>
    </channel></rss>`;
    const fetchImpl = async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("feed.xml")) return new Response(feed, { headers: { "content-type": "application/rss+xml" } });
      if (url.endsWith("/body")) return new Response(`<html><article>${"Internal article content ".repeat(10)}</article></html>`, { headers: { "content-type": "text/html" } });
      return new Response("blocked", { status: 403 });
    };
    const collector = new NewsCollectionService(store, { fetchImpl: fetchImpl as typeof fetch, now: () => NOW });
    const run = await collector.collectSource(registered.id, { trigger: "manual" });
    expect("counts" in run && run.counts.articleFailures).toBe(1);
    expect(store.listNews().find((item) => item.externalId === "with-body")?.body).toContain("Internal article content");
    expect(store.listNews().find((item) => item.externalId === "without-body")?.body).toBeUndefined();
  });

  it("passes the fixed bounded window to Guardian and resolves its secret by reference", async () => {
    const store = new FinanceStore();
    const registered = store.createNewsSource(source({
      slug: "guardian-test", name: "Guardian", adapterType: "guardian",
      endpoint: "https://content.guardianapis.com/search", secretRef: "GUARDIAN_API_KEY",
      config: { section: "business", pageSize: 10 }
    }));
    let requested: URL | undefined;
    const fetchImpl = async (input: string | URL | Request) => {
      requested = new URL(String(input));
      return new Response(JSON.stringify({
        response: {
          pages: 1,
          results: [{
            id: "business/1", webTitle: "Guardian item", webUrl: "https://www.theguardian.com/business/1",
            webPublicationDate: "2026-06-21T09:00:00.000Z", sectionId: "business",
            fields: { headline: "Guardian item", trailText: "<p>Trail</p>", bodyText: "Full internal text", lang: "en" }
          }]
        }
      }), { headers: { "content-type": "application/json" } });
    };
    const collector = new NewsCollectionService(store, {
      fetchImpl: fetchImpl as typeof fetch, now: () => NOW, environment: { GUARDIAN_API_KEY: "secret-value" }
    });
    const run = await collector.collectSource(registered.id, { trigger: "manual" });
    expect("status" in run && run.status).toBe("success");
    expect(requested?.searchParams.get("from-date")).toBe("2026-06-20T12:00:00.000Z");
    expect(requested?.searchParams.get("to-date")).toBe(NOW);
    expect(requested?.searchParams.get("api-key")).toBe("secret-value");
    expect(store.listNews()[0].body).toBe("Full internal text");
  });

  it("rejects private source URLs before making a request and prevents overlapping leases", async () => {
    const store = new FinanceStore();
    const privateSource = store.createNewsSource(source({ slug: "private-source", endpoint: "http://127.0.0.1/feed" }));
    let calls = 0;
    const collector = new NewsCollectionService(store, {
      fetchImpl: (async () => { calls++; return new Response(""); }) as typeof fetch, now: () => NOW
    });
    const failed = await collector.collectSource(privateSource.id, { trigger: "manual" });
    expect("status" in failed && failed.status).toBe("failed");
    expect(calls).toBe(0);

    const leased = store.createNewsSource(source({ slug: "leased-source" }));
    expect(store.acquireNewsSourceLease(leased.id, "other-worker", NOW)).toBe(true);
    const skipped = await collector.collectSource(leased.id, { trigger: "manual" });
    expect(skipped).toEqual({ sourceId: leased.id, status: "skipped", reason: "source_already_running" });
  });

  it.each([
    ["Atom", `<feed xmlns="http://www.w3.org/2005/Atom"><entry><id>atom-1</id><title>Atom story</title><link href="https://news.example.com/atom"/><updated>2026-06-21T11:00:00Z</updated></entry></feed>`],
    ["RDF", `<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:dc="http://purl.org/dc/elements/1.1/"><item><title>RDF story</title><link>https://news.example.com/rdf</link><dc:date>2026-06-21T11:00:00Z</dc:date></item></rdf:RDF>`]
  ])("parses %s feeds", async (_name, xml) => {
    const store = new FinanceStore();
    const registered = store.createNewsSource(source({ slug: `${_name.toLowerCase()}-source` }));
    const collector = new NewsCollectionService(store, {
      fetchImpl: (async () => new Response(xml, { headers: { "content-type": "application/xml" } })) as typeof fetch,
      now: () => NOW
    });
    const run = await collector.collectSource(registered.id, { trigger: "manual" });
    expect("counts" in run && run.counts.created).toBe(1);
  });

  it("rejects malformed and oversized responses and follows bounded redirects", async () => {
    const malformedStore = new FinanceStore();
    const malformedSource = malformedStore.createNewsSource(source({ slug: "malformed-source" }));
    const malformed = new NewsCollectionService(malformedStore, {
      fetchImpl: (async () => new Response("<rss><channel>", { headers: { "content-type": "application/xml" } })) as typeof fetch,
      now: () => NOW
    });
    const failed = await malformed.collectSource(malformedSource.id, { trigger: "manual" });
    expect("status" in failed && failed.status).toBe("failed");

    let calls = 0;
    const client = new BoundedHttpClient((async () => {
      calls++;
      if (calls === 1) return new Response(null, { status: 302, headers: { location: "https://news.example.com/final" } });
      return new Response("123456", { headers: { "content-type": "text/plain" } });
    }) as typeof fetch);
    await expect(client.get("https://news.example.com/start", { timeoutMs: 1000, maxBytes: 5 })).rejects.toThrow(/size limit/);
    expect(calls).toBe(2);
  });
});

describe("news source API and seed", () => {
  it("ships the complete consolidated catalog disabled by default", async () => {
    const rows = await loadNewsSourceSeed();
    expect(rows).toHaveLength(27);
    expect(new Set(rows.map((row) => row.slug)).size).toBe(27);
    expect(rows.every((row) => row.enabled === false)).toBe(true);
  });

  it("exposes source discovery and validates 24-hour triggers", async () => {
    const store = new FinanceStore();
    const collector = new NewsCollectionService(store, {
      fetchImpl: (async () => new Response("<rss><channel/></rss>", { headers: { "content-type": "application/xml" } })) as typeof fetch,
      now: () => NOW
    });
    const { app } = buildApp({ store, newsCollector: collector, config: { port: 0, apiToken: "token" } });
    const auth = { authorization: "Bearer token" };
    const sourcePayload = source({
      config: { candidateFilters: { blacklist: [{ value: "opinion", mode: "exact", target: "category", reason: "noise" }] } }
    });
    const created = await app.inject({ method: "POST", url: "/v1/news-sources", headers: auth, payload: sourcePayload });
    expect(created.statusCode).toBe(201);
    const createdSource = created.json();
    expect(createdSource.config.candidateFilters.blacklist[0]).toMatchObject({ value: "opinion", mode: "exact", target: "category" });
    const patched = await app.inject({
      method: "PATCH", url: `/v1/news-sources/${createdSource.id}`, headers: auth, payload: { enabled: false }
    });
    expect(patched.json()).toMatchObject({
      enabled: false, priority: "core", editorialType: "news", config: {}
    });
    const listed = await app.inject({ method: "GET", url: "/v1/news-sources?enabled=true", headers: auth });
    expect(listed.json()).toEqual([]);
    const invalid = await app.inject({
      method: "POST", url: "/v1/news-collection-runs", headers: auth,
      payload: { mode: "all_enabled", from: "2026-06-19T00:00:00.000Z", to: NOW }
    });
    expect(invalid.statusCode).toBe(400);
    await app.close();
  });

  it("replays source seeds without duplicates or state resets", async () => {
    const store = new FinanceStore();
    const rows = [source()];
    expect(await seedNewsSources(store, rows)).toMatchObject({ created: 1 });
    const registered = store.listNewsSources()[0];
    store.setNewsSourceState(registered.id, { watermark: NOW });
    expect(await seedNewsSources(store, rows)).toMatchObject({ unchanged: 1 });
    expect(store.getNewsSourceState(registered.id).watermark).toBe(NOW);
  });

  it("validates seed duplicates, endpoints, adapter configuration, and secret references", async () => {
    expect(() => source({ endpoint: "file:///tmp/feed.xml" })).toThrow();
    expect(() => source({ adapterType: "guardian", secretRef: undefined })).toThrow(/secret reference/);
    expect(() => source({ config: { executableTransform: "return input" } })).toThrow();
    expect(() => source({ config: { candidateFilters: { blacklist: [{ value: "[" , mode: "regex" }] } } })).toThrow(/regex/);

    const directory = await mkdtemp(join(tmpdir(), "news-seed-"));
    const path = join(directory, "sources.json");
    try {
      await writeFile(path, JSON.stringify([source(), source()]));
      await expect(loadNewsSourceSeed(new URL(`file://${path}`))).rejects.toThrow(/Duplicate/);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
