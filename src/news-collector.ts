import { createHash, randomUUID } from "node:crypto";
import { isIP } from "node:net";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import {
  type NewsCollectionCounts,
  type NewsCollectionRun,
  type NewsCollectionTrigger,
  type NewsItem,
  type NewsSource,
  type NewsSourceCandidateFilterRule,
  type NewsSourceState
} from "./domain.js";
import { validation } from "./errors.js";

const DAY_MS = 86_400_000;
const EMPTY_COUNTS = (): NewsCollectionCounts => ({
  fetched: 0, accepted: 0, created: 0, enriched: 0, duplicates: 0, rejected: 0, articleFailures: 0
});

export type CollectionWindow = { from: string; to: string; clamped: boolean };
export type NewsCandidate = {
  externalId?: string;
  url?: string;
  canonicalUrl?: string;
  title: string;
  summary?: string;
  body?: string;
  publishedAt: string;
  language?: string;
  region?: string;
  topicTags: string[];
};
type AdapterResult = {
  candidates: NewsCandidate[];
  fetched: number;
  rejected: number;
  articleFailures: number;
  diagnostics: string[];
  etag?: string;
  lastModified?: string;
  notModified?: boolean;
};
type AdapterContext = {
  source: NewsSource;
  state: NewsSourceState;
  window: CollectionWindow;
  http: BoundedHttpClient;
  secret?: string;
};

export function calculateCollectionWindow(input: {
  now: string;
  watermark?: string;
  overlapMinutes: number;
  from?: string;
  to?: string;
}): CollectionWindow {
  const toMs = Date.parse(input.to ?? input.now);
  if (!Number.isFinite(toMs)) throw validation("Invalid collection upper bound");
  const lowerBound = toMs - DAY_MS;
  if (input.from) {
    const fromMs = Date.parse(input.from);
    if (!Number.isFinite(fromMs) || fromMs > toMs) throw validation("Invalid collection window");
    if (fromMs < lowerBound) throw validation("Collection window cannot begin more than 24 hours before its upper bound");
    return { from: new Date(fromMs).toISOString(), to: new Date(toMs).toISOString(), clamped: false };
  }
  const desired = input.watermark ? Date.parse(input.watermark) - input.overlapMinutes * 60_000 : lowerBound;
  const fromMs = Math.max(Number.isFinite(desired) ? desired : lowerBound, lowerBound);
  return { from: new Date(fromMs).toISOString(), to: new Date(toMs).toISOString(), clamped: desired < lowerBound };
}

export class HttpStatusError extends Error {
  constructor(readonly status: number, readonly retryAfter?: string) { super(`Source returned HTTP ${status}`); }
}

export class BoundedHttpClient {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async get(urlValue: string, options: {
    timeoutMs: number;
    maxBytes: number;
    headers?: Record<string, string>;
    acceptedTypes?: string[];
    retries?: number;
  }): Promise<{ status: number; body: string; headers: Headers; url: string }> {
    let url = new URL(urlValue);
    this.assertSafe(url);
    const retries = options.retries ?? 1;
    for (let attempt = 0; ; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), options.timeoutMs);
      try {
        const response = await this.fetchImpl(url, {
          headers: { "user-agent": "JarvisFinanceNewsCollector/1.0", accept: "*/*", ...options.headers },
          redirect: "manual",
          signal: controller.signal
        });
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          const location = response.headers.get("location");
          if (!location) throw new HttpStatusError(response.status);
          url = new URL(location, url);
          this.assertSafe(url);
          if (attempt >= 4) throw validation("Too many source redirects");
          continue;
        }
        if ((response.status === 429 || response.status >= 500) && attempt < retries) {
          await delay(retryDelay(response.headers.get("retry-after"), attempt));
          continue;
        }
        if (response.status === 304) return { status: 304, body: "", headers: response.headers, url: url.toString() };
        if (!response.ok) throw new HttpStatusError(response.status, response.headers.get("retry-after") ?? undefined);
        const length = Number(response.headers.get("content-length") ?? 0);
        if (length > options.maxBytes) throw validation("Source response exceeds configured size limit");
        const type = (response.headers.get("content-type") ?? "").toLowerCase();
        if (options.acceptedTypes?.length && type && !options.acceptedTypes.some((accepted) => type.includes(accepted))) {
          throw validation("Source returned an unsupported content type", { contentType: type });
        }
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.byteLength > options.maxBytes) throw validation("Source response exceeds configured size limit");
        return { status: response.status, body: new TextDecoder().decode(bytes), headers: response.headers, url: url.toString() };
      } finally {
        clearTimeout(timer);
      }
    }
  }

  private assertSafe(url: URL): void {
    if (!["http:", "https:"].includes(url.protocol)) throw validation("Only HTTP(S) source URLs are allowed");
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) throw validation("Private source URLs are not allowed");
    if (isIP(host) && isPrivateIp(host)) throw validation("Private source URLs are not allowed");
  }
}

export class NewsCollectionService {
  private readonly http: BoundedHttpClient;
  constructor(
    private readonly store: any,
    options: { fetchImpl?: typeof fetch; now?: () => string; environment?: NodeJS.ProcessEnv } = {}
  ) {
    this.http = new BoundedHttpClient(options.fetchImpl);
    this.now = options.now ?? (() => new Date().toISOString());
    this.environment = options.environment ?? process.env;
  }
  private readonly now: () => string;
  private readonly environment: NodeJS.ProcessEnv;

  async trigger(input: {
    mode: "due" | "all_enabled" | "selected";
    sourceIds?: string[];
    trigger: NewsCollectionTrigger;
    from?: string;
    to?: string;
    concurrency: number;
  }): Promise<Array<NewsCollectionRun | { sourceId: string; status: "skipped"; reason: string }>> {
    const now = this.now();
    let sources: NewsSource[] = await this.store.listNewsSources({ enabled: true });
    if (input.mode === "selected") {
      const wanted = new Set(input.sourceIds ?? []);
      sources = sources.filter((source) => wanted.has(source.id) || wanted.has(source.slug));
      const matched = new Set(sources.flatMap((source) => [source.id, source.slug]));
      const missing = [...wanted].filter((value) => !matched.has(value));
      if (missing.length) throw validation("Unknown or disabled news sources", { sourceIds: missing });
    } else if (input.mode === "due") {
      sources = sources.filter((source) => {
        const state = this.store.getNewsSourceState(source.id);
        return !state.nextPollAt || state.nextPollAt <= now;
      });
    }
    const results: Array<NewsCollectionRun | { sourceId: string; status: "skipped"; reason: string }> = [];
    for (let index = 0; index < sources.length; index += input.concurrency) {
      results.push(...await Promise.all(sources.slice(index, index + input.concurrency).map((source) =>
        this.collectSource(source.id, { trigger: input.trigger, from: input.from, to: input.to }))));
    }
    return results;
  }

  async collectSource(sourceId: string, input: { trigger: NewsCollectionTrigger; from?: string; to?: string }):
  Promise<NewsCollectionRun | { sourceId: string; status: "skipped"; reason: string }> {
    const source: NewsSource = await this.store.getNewsSource(sourceId);
    const state: NewsSourceState = await this.store.getNewsSourceState(source.id);
    const startedAt = this.now();
    const window = calculateCollectionWindow({
      now: startedAt, watermark: state.watermark, overlapMinutes: source.overlapMinutes, from: input.from, to: input.to
    });
    const owner = `collector-${randomUUID()}`;
    if (!await this.store.acquireNewsSourceLease(source.id, owner, startedAt)) {
      return { sourceId: source.id, status: "skipped", reason: "source_already_running" };
    }
    const diagnostics = window.clamped ? ["collection window clamped to the latest 24 hours; older gap is unrecoverable"] : [];
    let run: NewsCollectionRun = await this.store.createNewsCollectionRun({
      sourceId: source.id, trigger: input.trigger, windowFrom: window.from, windowTo: window.to, status: "running",
      startedAt, counts: EMPTY_COUNTS(), diagnostics
    });
    try {
      const secret = source.secretRef ? this.environment[source.secretRef] : undefined;
      if (source.secretRef && !secret) throw validation("Configured source secret is unavailable", { secretRef: source.secretRef });
      const result = await this.adapter(source.adapterType)({ source, state, window, http: this.http, secret });
      const counts = { ...EMPTY_COUNTS(), fetched: result.fetched, rejected: result.rejected, articleFailures: result.articleFailures };
      const filterDiagnostics: string[] = [];
      const groupedNewsIds: string[] = [];
      let latest = state.latestItemAt;
      for (const candidate of result.candidates) {
        const filterDecision = evaluateCandidateFilters(source, candidate);
        if (filterDecision.rejected) {
          counts.rejected++;
          filterDiagnostics.push(filterDecision.diagnostic);
          continue;
        }
        counts.accepted++;
        const normalized = normalizeCandidate(source, candidate, startedAt);
        const persisted = await this.store.upsertCollectedNews(normalized);
        groupedNewsIds.push(persisted.item.id);
        if (persisted.result === "created") counts.created++;
        else if (persisted.result === "enriched") counts.enriched++;
        else counts.duplicates++;
        if (!latest || candidate.publishedAt > latest) latest = candidate.publishedAt;
      }
      const completedAt = this.now();
      const groupingDiagnostics = await this.runStoryGrouping(groupedNewsIds);
      const status = result.notModified ? "no_change" : counts.articleFailures || counts.rejected ? "partial" : "success";
      await this.store.setNewsSourceState(source.id, {
        watermark: window.to, etag: result.etag ?? state.etag, lastModified: result.lastModified ?? state.lastModified,
        latestItemAt: latest, lastAttemptAt: startedAt, lastSuccessAt: completedAt, consecutiveFailures: 0,
        nextPollAt: new Date(Date.parse(completedAt) + source.pollingIntervalMinutes * 60_000).toISOString(),
        lastErrorCode: undefined
      });
      run = await this.store.updateNewsCollectionRun(run.id, {
        status, completedAt, counts, diagnostics: [...diagnostics, ...result.diagnostics, ...filterDiagnostics, ...groupingDiagnostics]
      });
      return run;
    } catch (error) {
      const completedAt = this.now();
      const rateLimited = error instanceof HttpStatusError && error.status === 429;
      const code = rateLimited ? "rate_limited" : errorCode(error);
      await this.store.setNewsSourceState(source.id, {
        lastAttemptAt: startedAt, consecutiveFailures: state.consecutiveFailures + 1,
        nextPollAt: new Date(Date.parse(completedAt) + backoffMs(state.consecutiveFailures + 1)).toISOString(), lastErrorCode: code
      });
      run = await this.store.updateNewsCollectionRun(run.id, {
        status: rateLimited ? "rate_limited" : "failed", completedAt, errorCode: code,
        diagnostics: [...diagnostics, sanitizeError(error)]
      });
      return run;
    } finally {
      await this.store.releaseNewsSourceLease(source.id, owner);
    }
  }

  private adapter(type: NewsSource["adapterType"]): (context: AdapterContext) => Promise<AdapterResult> {
    if (type === "rss") return collectRss;
    if (type === "guardian") return collectGuardian;
    throw validation("Source adapter is not enabled", { adapterType: type });
  }

  private async runStoryGrouping(newsIds: string[]): Promise<string[]> {
    if (!newsIds.length || typeof this.store.groupNewsItems !== "function") return [];
    const groups = await this.store.groupNewsItems([...new Set(newsIds)]);
    const grouped = groups.filter((group: any) => group.sourceCount > 1).length;
    return grouped ? [`story grouping linked ${grouped} collected item(s) to multi-source clusters`] : [];
  }
}

async function collectRss(context: AdapterContext): Promise<AdapterResult> {
  const response = await context.http.get(context.source.endpoint, {
    timeoutMs: context.source.requestTimeoutMs, maxBytes: context.source.maxResponseBytes,
    acceptedTypes: ["xml", "rss", "atom", "text/plain", "octet-stream"],
    headers: {
      ...(context.state.etag ? { "if-none-match": context.state.etag } : {}),
      ...(context.state.lastModified ? { "if-modified-since": context.state.lastModified } : {})
    }
  });
  if (response.status === 304) return { candidates: [], fetched: 0, rejected: 0, articleFailures: 0, diagnostics: [], notModified: true };
  const validationResult = XMLValidator.validate(response.body);
  if (validationResult !== true) throw validation("Source returned malformed XML");
  const parsed = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", textNodeName: "#text", trimValues: true }).parse(response.body);
  const items = feedItems(parsed);
  const result: AdapterResult = {
    candidates: [], fetched: items.length, rejected: 0, articleFailures: 0, diagnostics: [],
    etag: response.headers.get("etag") ?? undefined, lastModified: response.headers.get("last-modified") ?? undefined
  };
  for (const item of items) {
    const publishedAt = parseDate(first(item.pubDate, item["dc:date"], item.published, item.updated));
    const title = text(item.title);
    if (!publishedAt || !title || publishedAt > allowedUpper(context)) {
      result.rejected++;
      continue;
    }
    if (publishedAt < context.window.from || publishedAt > context.window.to) continue;
    const url = linkValue(item.link);
    let body: string | undefined = text(first(item["content:encoded"], item.content)) || undefined;
    const summary = stripHtml(text(first(item.description, item.summary)));
    if (!body && context.source.config.fetchArticleContent && url) {
      try {
        const article = await context.http.get(url, {
          timeoutMs: context.source.requestTimeoutMs, maxBytes: context.source.maxResponseBytes,
          acceptedTypes: ["text/html", "application/xhtml"]
        });
        body = extractArticleText(article.body);
      } catch {
        result.articleFailures++;
      }
    }
    result.candidates.push({
      externalId: text(first(item.guid, item.id)) || undefined, url, canonicalUrl: url, title, summary: summary || undefined,
      body: body ? stripHtml(body) || undefined : undefined, publishedAt, language: context.source.language, region: context.source.region, topicTags: categories(item.category)
    });
  }
  result.candidates.sort((a, b) => a.publishedAt.localeCompare(b.publishedAt) || a.title.localeCompare(b.title));
  return result;
}

async function collectGuardian(context: AdapterContext): Promise<AdapterResult> {
  const candidates: NewsCandidate[] = [];
  let fetched = 0;
  let rejected = 0;
  const diagnostics: string[] = [];
  const pageSize = context.source.config.pageSize ?? 50;
  for (let page = 1; page <= 10; page++) {
    const url = new URL(context.source.endpoint);
    url.searchParams.set("from-date", context.window.from);
    url.searchParams.set("to-date", context.window.to);
    url.searchParams.set("order-by", "newest");
    url.searchParams.set("page-size", String(pageSize));
    url.searchParams.set("page", String(page));
    url.searchParams.set("show-fields", "headline,trailText,bodyText,lang");
    if (context.source.config.section) url.searchParams.set("section", context.source.config.section);
    if (context.source.config.query) url.searchParams.set("q", context.source.config.query);
    url.searchParams.set("api-key", context.secret!);
    const response = await context.http.get(url.toString(), {
      timeoutMs: context.source.requestTimeoutMs, maxBytes: context.source.maxResponseBytes, acceptedTypes: ["application/json"]
    });
    const payload = JSON.parse(response.body).response;
    const results = Array.isArray(payload?.results) ? payload.results : [];
    fetched += results.length;
    for (const item of results) {
      const publishedAt = parseDate(item.webPublicationDate);
      if (!publishedAt || publishedAt > allowedUpper(context)) { rejected++; continue; }
      if (publishedAt < context.window.from || publishedAt > context.window.to) continue;
      candidates.push({
        externalId: String(item.id), url: item.webUrl, canonicalUrl: item.webUrl,
        title: item.fields?.headline ?? item.webTitle, summary: stripHtml(item.fields?.trailText ?? ""),
        body: item.fields?.bodyText, publishedAt, language: item.fields?.lang ?? context.source.language,
        region: context.source.region, topicTags: [item.sectionId].filter(Boolean)
      });
    }
    if (!payload?.pages || page >= payload.pages || results.length === 0) break;
    if (results.some((item: any) => item.webPublicationDate < context.window.from)) break;
  }
  candidates.sort((a, b) => a.publishedAt.localeCompare(b.publishedAt) || a.title.localeCompare(b.title));
  return { candidates, fetched, rejected, articleFailures: 0, diagnostics };
}

function normalizeCandidate(source: NewsSource, candidate: NewsCandidate, retrievedAt: string):
Omit<NewsItem, "id" | "createdAt" | "updatedAt" | "processedAt" | "processedBy" | "processingNotes"> {
  const canonicalUrl = candidate.canonicalUrl ? canonicalizeUrl(candidate.canonicalUrl) : undefined;
  const rawHash = hash([source.id, candidate.title.trim(), candidate.publishedAt, candidate.body ?? candidate.summary ?? ""].join("\n"));
  return {
    source: source.name, sourceId: source.id, externalId: candidate.externalId, url: candidate.url, canonicalUrl,
    title: candidate.title.trim(), summary: candidate.summary, body: candidate.body, publishedAt: candidate.publishedAt,
    retrievedAt, language: candidate.language ?? source.language, region: candidate.region ?? source.region,
    topicTags: candidate.topicTags, rawHash, duplicateGroup: canonicalUrl ? hash(canonicalUrl) : rawHash, relatedInvestmentIds: []
  };
}

function evaluateCandidateFilters(source: NewsSource, candidate: NewsCandidate):
{ rejected: false } | { rejected: true; diagnostic: string } {
  const whitelist = enabledRules(source.config.candidateFilters?.whitelist);
  const blacklist = enabledRules(source.config.candidateFilters?.blacklist);
  if (!whitelist.length && !blacklist.length) return { rejected: false };
  if (whitelist.some((rule) => ruleMatches(rule, candidate))) return { rejected: false };
  const matchedBlacklist = blacklist.find((rule) => ruleMatches(rule, candidate));
  if (!matchedBlacklist) return { rejected: false };
  return {
    rejected: true,
    diagnostic: `candidate filtered by blacklist source=${source.slug} target=${matchedBlacklist.target} mode=${matchedBlacklist.mode} value=${bounded(matchedBlacklist.value, 80)} candidate=${candidateIdentity(candidate)}`
  };
}

function enabledRules(rules: NewsSourceCandidateFilterRule[] | undefined): NewsSourceCandidateFilterRule[] {
  return (rules ?? []).filter((rule) => rule.enabled !== false);
}

function ruleMatches(rule: NewsSourceCandidateFilterRule, candidate: NewsCandidate): boolean {
  return targetTexts(rule.target, candidate).some((value) => matchText(rule, normalizeFilterText(value)));
}

function targetTexts(target: NewsSourceCandidateFilterRule["target"], candidate: NewsCandidate): string[] {
  const values: string[] = [];
  if (target === "title" || target === "both") values.push(candidate.title);
  if (target === "category" || target === "both") values.push(...candidate.topicTags);
  return values;
}

function matchText(rule: NewsSourceCandidateFilterRule, textValue: string): boolean {
  const ruleValue = normalizeFilterText(rule.value);
  if (!ruleValue) return false;
  if (rule.mode === "contains") return textValue.includes(ruleValue);
  if (rule.mode === "exact") return textValue === ruleValue;
  if (rule.mode === "word") return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escapeRegExp(ruleValue)}(?:$|[^\\p{L}\\p{N}])`, "u").test(textValue);
  return new RegExp(rule.value, "iu").test(textValue);
}

function normalizeFilterText(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim().replace(/\s+/g, " ").slice(0, 1000);
}

function candidateIdentity(candidate: NewsCandidate): string {
  return bounded(candidate.externalId ?? candidate.canonicalUrl ?? candidate.url ?? hash(`${candidate.title}\n${candidate.publishedAt}`).slice(0, 16), 120);
}

function bounded(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 3)}...`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function feedItems(parsed: any): any[] {
  return array(parsed?.rss?.channel?.item ?? parsed?.feed?.entry ?? parsed?.["rdf:RDF"]?.item ?? parsed?.RDF?.item);
}
function array<T>(value: T | T[] | undefined): T[] { return value === undefined ? [] : Array.isArray(value) ? value : [value]; }
function first(...values: any[]): any { return values.find((value) => value !== undefined && value !== null && value !== ""); }
function text(value: any): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (Array.isArray(value)) return text(value[0]);
  return text(value["#text"] ?? value["@_href"] ?? "");
}
function linkValue(value: any): string | undefined {
  for (const item of array(value)) {
    const candidate = typeof item === "string" ? item : item?.["@_href"] ?? item?.["#text"];
    if (candidate && /^https?:\/\//i.test(String(candidate))) return String(candidate);
  }
  return undefined;
}
function categories(value: any): string[] {
  return [...new Set(array(value).map((item) => text(item?.["@_term"] ?? item)).filter(Boolean))];
}
function parseDate(value: any): string | undefined {
  const timestamp = Date.parse(text(value));
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
}
function allowedUpper(context: AdapterContext): string {
  if (context.source.config.allowFutureEvents) return "9999-12-31T23:59:59.999Z";
  return new Date(Date.parse(context.window.to) + (context.source.config.futureToleranceMinutes ?? 5) * 60_000).toISOString();
}
function stripHtml(value: string): string {
  return value.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, "\"")
    .replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
}
function extractArticleText(html: string): string | undefined {
  const article = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1]
    ?? html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1]
    ?? html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1];
  const cleaned = article ? stripHtml(article) : "";
  return cleaned.length >= 80 ? cleaned : undefined;
}
function canonicalizeUrl(value: string): string {
  const url = new URL(value);
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith("utm_") || ["gclid", "fbclid"].includes(key.toLowerCase())) url.searchParams.delete(key);
  }
  return url.toString();
}
function hash(value: string): string { return createHash("sha256").update(value).digest("hex"); }
function retryDelay(value: string | null, attempt: number): number {
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.min(seconds * 1000, 2000);
  return Math.min(250 * 2 ** attempt + Math.floor(Math.random() * 100), 2000);
}
function backoffMs(failures: number): number { return Math.min(15 * 60_000 * 2 ** Math.max(0, failures - 1), 24 * 60 * 60_000); }
function delay(ms: number): Promise<void> { return new Promise((resolve) => setTimeout(resolve, ms)); }
function errorCode(error: unknown): string {
  if (error instanceof HttpStatusError) return `http_${error.status}`;
  return error instanceof Error && error.name === "AbortError" ? "timeout" : "collection_failed";
}
function sanitizeError(error: unknown): string {
  if (error instanceof HttpStatusError) return `source request failed with HTTP ${error.status}`;
  if (error instanceof Error && error.name === "AbortError") return "source request timed out";
  return error instanceof Error ? error.message.replace(/([?&](?:api-key|apikey|token|key))=[^&\s]+/gi, "$1=[redacted]").slice(0, 500) : "unknown collection error";
}
function isPrivateIp(host: string): boolean {
  if (host.includes(":")) return host === "::1" || host.toLowerCase().startsWith("fc") || host.toLowerCase().startsWith("fd") || host.toLowerCase().startsWith("fe80");
  const [a, b] = host.split(".").map(Number);
  return a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}
