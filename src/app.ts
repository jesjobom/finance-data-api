import Fastify from "fastify";
import { z } from "zod";
import { requireBearerToken } from "./auth.js";
import { loadConfig, type AppConfig } from "./config.js";
import {
  benchmarkCreateSchema,
  benchmarkObservationCreateSchema,
  brokerageAccountCreateSchema,
  fxRateCreateSchema,
  investmentCreateSchema,
  investmentPatchSchema,
  newsCreateSchema,
  newsCollectionTriggerSchema,
  newsPatchSchema,
  newsSourceCreateSchema,
  newsSourcePatchSchema,
  openingPositionCreateSchema,
  operationCreateSchema,
  operationRevisionSchema,
  portfolioPatchSchema,
  priceObservationCreateSchema,
  processingSchema,
  snapshotCreateSchema,
  statementCreateSchema,
  virtualPortfolioCreateSchema,
  virtualPositionCreateSchema,
  watchedAssetCreateSchema
} from "./domain.js";
import { sendError } from "./errors.js";
import { openApiDocument } from "./openapi.js";
import { NewsCollectionService } from "./news-collector.js";
import { FinanceStore } from "./store.js";

const idParams = z.object({ id: z.string().min(1) });
const portfolioIdParams = z.object({ portfolioId: z.string().min(1) });

export function buildApp(options: { store?: any; config?: AppConfig; newsCollector?: NewsCollectionService } = {}) {
  const store = options.store ?? new FinanceStore();
  const newsCollector = options.newsCollector ?? new NewsCollectionService(store);
  const config = options.config ?? loadConfig();
  const app = Fastify({ logger: false });

  app.setErrorHandler((error, _request, reply) => sendError(reply, error));

  app.get("/health", async () => ({ status: "ok" }));
  app.get("/openapi.json", async () => openApiDocument);

  app.addHook("preHandler", async (request, reply) => {
    if (request.url === "/health" || request.url === "/openapi.json") return;
    await requireBearerToken(config.apiToken)(request, reply);
  });

  app.post("/v1/investments", async (request, reply) => {
    const input = investmentCreateSchema.parse(request.body);
    return reply.code(201).send(await store.createInvestment({ ...input, active: true }));
  });

  app.get("/v1/investments", async () => store.listInvestments());
  app.get("/v1/investments/:id", async (request) => store.getInvestment(idParams.parse(request.params).id));
  app.patch("/v1/investments/:id", async (request) => store.updateInvestment(idParams.parse(request.params).id, investmentPatchSchema.parse(request.body)));
  app.post("/v1/investments/:id/deactivate", async (request) => store.deactivateInvestment(idParams.parse(request.params).id));

  app.post("/v1/assets", async (request, reply) => {
    const input = investmentCreateSchema.parse(request.body);
    return reply.code(201).send(await store.createInvestment({ ...input, active: true }));
  });
  app.get("/v1/assets", async () => store.listInvestments());
  app.get("/v1/assets/:id", async (request) => store.getInvestment(idParams.parse(request.params).id));

  app.get("/v1/portfolios/:id", async (request) => store.getPortfolio(idParams.parse(request.params).id));
  app.patch("/v1/portfolios/:id", async (request) => store.updatePortfolio(idParams.parse(request.params).id, portfolioPatchSchema.parse(request.body)));
  app.post("/v1/accounts", async (request, reply) => {
    const input = brokerageAccountCreateSchema.parse(request.body);
    return reply.code(201).send(await store.createAccount({ ...input, active: true }));
  });
  app.get("/v1/accounts", async (request) => {
    const query = z.object({ portfolioId: z.string().optional() }).parse(request.query);
    return store.listAccounts(query.portfolioId);
  });
  app.get("/v1/accounts/:id", async (request) => store.getAccount(idParams.parse(request.params).id));
  app.post("/v1/opening-positions", async (request, reply) => reply.code(201).send(
    await store.createOpeningPosition(openingPositionCreateSchema.parse(request.body))
  ));
  app.get("/v1/opening-positions", async (request) => {
    const query = z.object({ portfolioId: z.string().optional() }).parse(request.query);
    return store.listOpeningPositions(query.portfolioId);
  });

  app.post("/v1/operations", async (request, reply) => {
    const input = operationCreateSchema.parse(request.body);
    const replay = input.importSource && input.externalId
      ? store.listOperations().find((item: any) => item.importSource === input.importSource && item.accountId === input.accountId && item.externalId === input.externalId)
      : undefined;
    const operation = await store.createOperation(input);
    return reply.code(replay ? 200 : 201).send({ ...operation, importResult: replay ? "replayed" : "created" });
  });
  app.get("/v1/operations", async (request) => {
    const query = z.object({ investmentId: z.string().optional() }).parse(request.query);
    return store.listOperations(query.investmentId);
  });
  app.get("/v1/operations/:id", async (request) => store.getOperation(idParams.parse(request.params).id));
  app.patch("/v1/operations/:id", async (request) => {
    const input = operationRevisionSchema.parse(request.body);
    return store.reviseOperation(idParams.parse(request.params).id, input);
  });
  app.get("/v1/operations/:id/revisions", async (request) => store.listOperationRevisions(idParams.parse(request.params).id));
  app.post("/v1/operations/:id/review", async (request) => {
    const body = processingSchema.parse(request.body);
    return store.markOperationReviewed(idParams.parse(request.params).id, body.actor, body.notes);
  });

  app.post("/v1/news", async (request, reply) => {
    const input = newsCreateSchema.parse(request.body);
    return reply.code(201).send(await store.createNews(input));
  });
  app.get("/v1/news", async (request) => {
    const query = z.object({
      date: z.string().date().optional(),
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
      investmentId: z.string().optional(),
      watched: z.coerce.boolean().optional(),
      unprocessed: z.coerce.boolean().optional()
    }).parse(request.query);
    return store.listNews(query);
  });
  app.get("/v1/news/:id", async (request) => store.getNews(idParams.parse(request.params).id));
  app.patch("/v1/news/:id", async (request) => store.updateNews(idParams.parse(request.params).id, newsPatchSchema.parse(request.body)));
  app.post("/v1/news/:id/process", async (request) => {
    const body = processingSchema.parse(request.body);
    return store.markNewsProcessed(idParams.parse(request.params).id, body.actor, body.notes);
  });
  app.post("/v1/news-sources", async (request, reply) =>
    reply.code(201).send(await store.createNewsSource(newsSourceCreateSchema.parse(request.body))));
  app.get("/v1/news-sources", async (request) => {
    const query = z.object({
      enabled: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
      priority: z.string().optional(),
      editorialType: z.string().optional()
    }).parse(request.query);
    const sources = await store.listNewsSources(query);
    return Promise.all(sources.map(async (source: any) => ({ ...source, health: await store.newsSourceHealth(source.id) })));
  });
  app.get("/v1/news-sources/:id", async (request) => {
    const source = await store.getNewsSource(idParams.parse(request.params).id);
    return { ...source, health: await store.newsSourceHealth(source.id), state: await store.getNewsSourceState(source.id) };
  });
  app.patch("/v1/news-sources/:id", async (request) => {
    const id = idParams.parse(request.params).id;
    const rawPatch = z.record(z.string(), z.unknown()).parse(request.body);
    const parsedPatch = newsSourcePatchSchema.parse(rawPatch);
    const patch = Object.fromEntries(Object.keys(rawPatch).map((key) => [
      key, (parsedPatch as Record<string, unknown>)[key]
    ]));
    const current = await store.getNewsSource(id);
    newsSourceCreateSchema.parse({ ...current, ...patch });
    return store.updateNewsSource(id, patch);
  });
  app.post("/v1/news-collection-runs", async (request, reply) => {
    const input = newsCollectionTriggerSchema.parse(request.body);
    return reply.code(202).send(await newsCollector.trigger(input));
  });
  app.get("/v1/news-collection-runs", async (request) => {
    const query = z.object({
      sourceId: z.string().optional(),
      status: z.enum(["running", "success", "no_change", "partial", "failed", "rate_limited", "skipped"]).optional(),
      trigger: z.enum(["scheduled", "manual", "cli"]).optional(),
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional()
    }).parse(request.query);
    return store.listNewsCollectionRuns(query);
  });
  app.get("/v1/news-collection-runs/:id", async (request) =>
    store.getNewsCollectionRun(idParams.parse(request.params).id));

  app.post("/v1/watched-assets", async (request, reply) => {
    const input = watchedAssetCreateSchema.parse(request.body);
    return reply.code(201).send(await store.createWatchedAsset({ ...input, active: true }));
  });
  app.get("/v1/watched-assets", async () => store.listWatchedAssets());

  app.post("/v1/virtual-portfolios", async (request, reply) => {
    const input = virtualPortfolioCreateSchema.parse(request.body);
    return reply.code(201).send(await store.createVirtualPortfolio(input));
  });
  app.get("/v1/virtual-portfolios", async () => store.listVirtualPortfolios());
  app.post("/v1/virtual-portfolios/:portfolioId/positions", async (request, reply) => {
    const input = virtualPositionCreateSchema.parse(request.body);
    return reply.code(201).send(await store.createVirtualPosition(portfolioIdParams.parse(request.params).portfolioId, input));
  });
  app.get("/v1/virtual-portfolios/:portfolioId/compare", async (request) => store.compareVirtualPortfolio(portfolioIdParams.parse(request.params).portfolioId));

  app.post("/v1/benchmarks", async (request, reply) => reply.code(201).send(await store.createBenchmark(benchmarkCreateSchema.parse(request.body))));
  app.get("/v1/benchmarks", async () => store.listBenchmarks());
  app.post("/v1/benchmark-observations", async (request, reply) =>
    reply.code(201).send(await store.createBenchmarkObservation(benchmarkObservationCreateSchema.parse(request.body))));
  app.get("/v1/benchmark-observations", async (request) => {
    const query = z.object({ benchmarkId: z.string().optional() }).parse(request.query);
    return store.listBenchmarkObservations(query.benchmarkId);
  });

  app.post("/v1/snapshots", async (request, reply) => reply.code(201).send(await store.createSnapshot(snapshotCreateSchema.parse(request.body))));
  app.get("/v1/snapshots/latest", async () => store.latestSnapshot() ?? null);

  app.post("/v1/prices", async (request, reply) => reply.code(201).send(await store.createPrice(priceObservationCreateSchema.parse(request.body))));
  app.get("/v1/prices", async (request) => {
    const query = z.object({ investmentId: z.string().optional() }).parse(request.query);
    return store.listPrices(query.investmentId);
  });
  app.post("/v1/fx-rates", async (request, reply) => reply.code(201).send(await store.createFxRate(fxRateCreateSchema.parse(request.body))));
  app.get("/v1/fx-rates", async (request) => {
    const query = z.object({ baseCurrency: z.string().length(3).optional(), quoteCurrency: z.string().length(3).optional() }).parse(request.query);
    return store.listFxRates(query.baseCurrency?.toUpperCase(), query.quoteCurrency?.toUpperCase());
  });

  app.post("/v1/statements", async (request, reply) => reply.code(201).send(await store.createStatement(statementCreateSchema.parse(request.body))));
  app.get("/v1/statements", async (request) => {
    const query = z.object({ accountId: z.string().optional() }).parse(request.query);
    return store.listStatements(query.accountId);
  });
  app.get("/v1/statements/:id", async (request) => store.getStatement(idParams.parse(request.params).id));
  app.post("/v1/statements/:id/reconcile", async (request, reply) => reply.code(201).send(await store.reconcileStatement(idParams.parse(request.params).id)));
  app.get("/v1/reconciliations", async (request) => {
    const query = z.object({ accountId: z.string().optional() }).parse(request.query);
    return store.listReconciliations(query.accountId);
  });
  app.get("/v1/reconciliations/:id", async (request) => store.getReconciliation(idParams.parse(request.params).id));

  app.get("/v1/portfolio/current", async (request) => {
    const query = z.object({ accountId: z.string().optional() }).parse(request.query);
    return store.currentPortfolio(undefined, query.accountId);
  });
  app.get("/v1/portfolio/at/:date", async (request) => {
    const params = z.object({ date: z.string().date() }).parse(request.params);
    return store.currentPortfolio(params.date);
  });
  app.get("/v1/portfolio/value/:date", async (request) => {
    const params = z.object({ date: z.string().date() }).parse(request.params);
    const query = z.object({ source: z.string().optional() }).parse(request.query);
    return store.valuedPortfolio(params.date, query.source);
  });
  app.get("/v1/allocations/:by", async (request) => {
    const params = z.object({ by: z.enum(["asset", "assetClass", "currency", "country", "market", "broker", "account"]) }).parse(request.params);
    return store.allocations(params.by);
  });
  app.get("/v1/allocations/:by/value/:date", async (request) => {
    const params = z.object({
      by: z.enum(["asset", "assetClass", "currency", "country", "market", "broker", "account"]),
      date: z.string().date()
    }).parse(request.params);
    const query = z.object({ source: z.string().optional() }).parse(request.query);
    return store.valuedAllocations(params.by, params.date, query.source);
  });
  app.get("/v1/portfolio/analytics/:date", async (request) => {
    const params = z.object({ date: z.string().date() }).parse(request.params);
    const query = z.object({ source: z.string().optional() }).parse(request.query);
    return store.portfolioAnalytics(params.date, query.source);
  });
  app.get("/v1/portfolio/concentration/:date", async (request) => {
    const params = z.object({ date: z.string().date() }).parse(request.params);
    const query = z.object({ top: z.coerce.number().int().min(1).max(100).default(5), source: z.string().optional() }).parse(request.query);
    return store.concentration(params.date, query.top, query.source);
  });
  app.get("/v1/portfolio/evolution", async (request) => {
    const query = z.object({
      from: z.string().date(),
      to: z.string().date(),
      interval: z.enum(["daily", "weekly", "monthly"]).default("monthly"),
      source: z.string().optional(),
      benchmarkId: z.string().optional()
    }).parse(request.query);
    return store.portfolioEvolution(query);
  });
  app.get("/v1/daily-package/:date", async (request) => {
    const params = z.object({ date: z.string().date() }).parse(request.params);
    return store.dailyPackage(params.date);
  });
  app.get("/v1/changes", async (request) => {
    const query = z.object({ cursor: z.string().optional() }).parse(request.query);
    return store.changesSince(query.cursor);
  });
  app.get("/v1/pending-work", async () => store.pendingWork());

  return { app, store, newsCollector };
}
