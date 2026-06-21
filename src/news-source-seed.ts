import { readFile } from "node:fs/promises";
import { newsSourceCreateSchema, type NewsSource } from "./domain.js";

export type NewsSourceSeedResult = { created: number; updated: number; unchanged: number; skipped: number };

export async function loadNewsSourceSeed(path = new URL("../seeds/news-sources.json", import.meta.url)): Promise<Array<Omit<NewsSource, "id" | "createdAt" | "updatedAt">>> {
  const rows = JSON.parse(await readFile(path, "utf8"));
  if (!Array.isArray(rows)) throw new Error("News source seed must be an array");
  const parsed = rows.map((row) => newsSourceCreateSchema.parse(row));
  const slugs = new Set<string>();
  for (const row of parsed) {
    if (slugs.has(row.slug)) throw new Error(`Duplicate news source seed slug: ${row.slug}`);
    slugs.add(row.slug);
  }
  return parsed;
}

export async function seedNewsSources(
  store: any,
  rows?: Array<Omit<NewsSource, "id" | "createdAt" | "updatedAt">>
): Promise<NewsSourceSeedResult> {
  rows ??= await loadNewsSourceSeed();
  const result: NewsSourceSeedResult = { created: 0, updated: 0, unchanged: 0, skipped: 0 };
  const existing: NewsSource[] = await store.listNewsSources();
  for (const row of rows) {
    const current = existing.find((item) => item.slug === row.slug);
    if (!current) {
      await store.createNewsSource(row);
      result.created++;
      continue;
    }
    const owned = {
      name: row.name, adapterType: row.adapterType, endpoint: row.endpoint, priority: row.priority,
      editorialType: row.editorialType, language: row.language, region: row.region, accessTier: row.accessTier,
      pollingIntervalMinutes: row.pollingIntervalMinutes, staleAfterMinutes: row.staleAfterMinutes,
      overlapMinutes: row.overlapMinutes, requestTimeoutMs: row.requestTimeoutMs, maxResponseBytes: row.maxResponseBytes,
      maxConcurrency: row.maxConcurrency, secretRef: row.secretRef, config: row.config, disabledReason: row.disabledReason
    };
    const same = Object.entries(owned).every(([key, value]) =>
      JSON.stringify((current as unknown as Record<string, unknown>)[key]) === JSON.stringify(value));
    if (same) result.unchanged++;
    else {
      await store.updateNewsSource(current.id, owned);
      result.updated++;
    }
  }
  return result;
}
