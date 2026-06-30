import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import pg from "pg";
import {
  type Benchmark, type BenchmarkObservation, type BrokerageAccount, type ClassificationReview, type ClassificationReviewCreateInput,
  type ClassificationResolutionCreateInput, type ClassificationTargetResolution, type FxRate, type Investment, type NewsClassification,
  type NewsClassificationCreateInput, type NewsItem, type OpeningPosition,
  type NewsCollectionRun, type NewsSource, type NewsSourceState, type NewsStoryCluster, type NewsStoryMention, type Operation, type Portfolio, type PortfolioSnapshot, type PortfolioStatement, type PriceObservation,
  type Reconciliation, type VirtualPortfolio, type VirtualPosition, type WatchedAsset, newId, nowIso
} from "./domain.js";
import { FinanceStore } from "./store.js";

type Row = Record<string, unknown>;

export class PostgresFinanceStore {
  private newsRefresh?: Promise<void>;

  private constructor(private readonly pool: pg.Pool, private readonly cache: FinanceStore) {}

  static async connect(connectionString: string): Promise<PostgresFinanceStore> {
    const pool = new pg.Pool({ connectionString });
    await applyMigrations(pool);
    return new PostgresFinanceStore(pool, await loadCache(pool));
  }
  async close(): Promise<void> { await this.pool.end(); }

  getPortfolio(id?: string) { return this.cache.getPortfolio(id); }
  listAccounts(portfolioId?: string) { return this.cache.listAccounts(portfolioId); }
  getAccount(id: string) { return this.cache.getAccount(id); }
  listInvestments() { return this.cache.listInvestments(); }
  getInvestment(id: string) { return this.cache.getInvestment(id); }
  listOpeningPositions(portfolioId?: string) { return this.cache.listOpeningPositions(portfolioId); }
  listOperations(investmentId?: string) { return this.cache.listOperations(investmentId); }
  getOperation(id: string) { return this.cache.getOperation(id); }
  listOperationRevisions(id: string) { return this.cache.listOperationRevisions(id); }
  listPrices(investmentId?: string) { return this.cache.listPrices(investmentId); }
  listFxRates(base?: string, quote?: string) { return this.cache.listFxRates(base, quote); }
  listStatements(accountId?: string) { return this.cache.listStatements(accountId); }
  getStatement(id: string) { return this.cache.getStatement(id); }
  listReconciliations(accountId?: string) { return this.cache.listReconciliations(accountId); }
  getReconciliation(id: string) { return this.cache.getReconciliation(id); }
  async listNews(filters?: Parameters<FinanceStore["listNews"]>[0]) {
    await this.refreshNewsDomain();
    return this.cache.listNews(filters);
  }
  async getNews(id: string) {
    await this.refreshNewsDomain();
    return this.cache.getNews(id);
  }
  listNewsSources(filters?: Parameters<FinanceStore["listNewsSources"]>[0]) { return this.cache.listNewsSources(filters); }
  getNewsSource(id: string) { return this.cache.getNewsSource(id); }
  getNewsSourceState(id: string) { return this.cache.getNewsSourceState(id); }
  newsSourceHealth(id: string, at?: string) { return this.cache.newsSourceHealth(id, at); }
  listNewsCollectionRuns(filters?: Parameters<FinanceStore["listNewsCollectionRuns"]>[0]) { return this.cache.listNewsCollectionRuns(filters); }
  getNewsCollectionRun(id: string) { return this.cache.getNewsCollectionRun(id); }
  async getNewsClassification(id: string) {
    await this.refreshNewsDomain();
    return this.cache.getNewsClassification(id);
  }
  async listNewsClassifications(filters?: Parameters<FinanceStore["listNewsClassifications"]>[0]) {
    await this.refreshNewsDomain();
    return this.cache.listNewsClassifications(filters);
  }
  async listNewsClassificationHistory(newsId: string, current?: boolean) {
    await this.refreshNewsDomain();
    return this.cache.listNewsClassificationHistory(newsId, current);
  }
  async listClassificationReviews(id: string) {
    await this.refreshNewsDomain();
    return this.cache.listClassificationReviews(id);
  }
  async effectiveClassificationReview(id: string) {
    await this.refreshNewsDomain();
    return this.cache.effectiveClassificationReview(id);
  }
  async listClassificationTargetResolutions(id: string) {
    await this.refreshNewsDomain();
    return this.cache.listClassificationTargetResolutions(id);
  }
  async classificationQueue(kind: Parameters<FinanceStore["classificationQueue"]>[0], limit?: number) {
    await this.refreshNewsDomain();
    return this.cache.classificationQueue(kind, limit);
  }
  async getNewsStoryCluster(id: string) {
    await this.refreshNewsDomain();
    return this.cache.getNewsStoryCluster(id);
  }
  async listNewsStoryClusters(filters?: Parameters<FinanceStore["listNewsStoryClusters"]>[0]) {
    await this.refreshNewsDomain();
    return this.cache.listNewsStoryClusters(filters);
  }
  async groupNewsItem(newsId: string) {
    await this.refreshNewsDomain();
    const beforeClusterIds = new Set(this.cache.newsStoryClusters.keys());
    const beforeMentionIds = new Set(this.cache.newsStoryMentions.keys());
    const view = this.cache.groupNewsItem(newsId);
    await this.persistStoryGraph([...this.cache.newsStoryClusters.values()].filter((story) => !beforeClusterIds.has(story.id) || story.id === view.id),
      [...this.cache.newsStoryMentions.values()].filter((mention) => !beforeMentionIds.has(mention.id) || mention.storyId === view.id));
    return view;
  }
  listWatchedAssets() { return this.cache.listWatchedAssets(); }
  listVirtualPortfolios() { return this.cache.listVirtualPortfolios(); }
  listBenchmarks() { return this.cache.listBenchmarks(); }
  listBenchmarkObservations(benchmarkId?: string) { return this.cache.listBenchmarkObservations(benchmarkId); }
  latestSnapshot() { return this.cache.latestSnapshot(); }
  currentPortfolio(asOf?: string, accountId?: string) { return this.cache.currentPortfolio(asOf, accountId); }
  valuedPortfolio(asOf: string, source?: string) { return this.cache.valuedPortfolio(asOf, source); }
  valuedAllocations(by: Parameters<FinanceStore["valuedAllocations"]>[0], asOf: string, source?: string) { return this.cache.valuedAllocations(by, asOf, source); }
  allocations(by: Parameters<FinanceStore["allocations"]>[0]) { return this.cache.allocations(by); }
  dailyPackage(date: string) { return this.cache.dailyPackage(date); }
  changesSince(cursor?: string) { return this.cache.changesSince(cursor); }
  compareVirtualPortfolio(id: string) { return this.cache.compareVirtualPortfolio(id); }
  async pendingWork() {
    await this.refreshNewsDomain();
    return this.cache.pendingWork();
  }
  portfolioAnalytics(asOf: string, source?: string) { return this.cache.portfolioAnalytics(asOf, source); }
  concentration(asOf: string, top: number, source?: string) { return this.cache.concentration(asOf, top, source); }
  portfolioEvolution(input: Parameters<FinanceStore["portfolioEvolution"]>[0]) { return this.cache.portfolioEvolution(input); }

  private async refreshNewsDomain(): Promise<void> {
    if (!this.newsRefresh) {
      this.newsRefresh = refreshNewsDomain(this.pool, this.cache).finally(() => { this.newsRefresh = undefined; });
    }
    await this.newsRefresh;
  }

  async updatePortfolio(id: string, patch: Partial<Omit<Portfolio, "id" | "createdAt" | "updatedAt">>): Promise<Portfolio> {
    const updated = this.cache.updatePortfolio(id, patch);
    await this.pool.query("UPDATE portfolios SET name=$2, base_currency=$3, reliable_from=$4, updated_at=$5 WHERE id=$1",
      [id, updated.name, updated.baseCurrency, updated.reliableFrom, updated.updatedAt]);
    return updated;
  }

  async createAccount(input: Omit<BrokerageAccount, "id" | "createdAt" | "updatedAt">): Promise<BrokerageAccount> {
    const record = this.cache.createAccount(input);
    await this.pool.query(
      "INSERT INTO brokerage_accounts(id, portfolio_id, name, institution, external_id, active, created_at, updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
      [record.id, record.portfolioId, record.name, record.institution, record.externalId, record.active, record.createdAt, record.updatedAt]);
    return record;
  }

  async createInvestment(input: Omit<Investment, "id" | "createdAt" | "updatedAt">): Promise<Investment> {
    const record = this.cache.createInvestment(input);
    await this.pool.query(
      `INSERT INTO investments(id, symbol, name, asset_class, currency, market, isin, country, broker, active, created_at, updated_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [record.id, record.symbol, record.name, record.assetClass, record.currency, record.market, record.isin, record.country, record.broker, record.active, record.createdAt, record.updatedAt]);
    return record;
  }
  async updateInvestment(id: string, patch: Partial<Omit<Investment, "id" | "createdAt" | "updatedAt">>): Promise<Investment> {
    const updated = this.cache.updateInvestment(id, patch);
    await this.pool.query(
      `UPDATE investments SET symbol=$2, name=$3, asset_class=$4, currency=$5, market=$6, isin=$7, country=$8, broker=$9, active=$10, updated_at=$11 WHERE id=$1`,
      [id, updated.symbol, updated.name, updated.assetClass, updated.currency, updated.market, updated.isin, updated.country, updated.broker, updated.active, updated.updatedAt]);
    return updated;
  }
  deactivateInvestment(id: string): Promise<Investment> { return this.updateInvestment(id, { active: false }); }

  async createOpeningPosition(input: Omit<OpeningPosition, "id" | "createdAt" | "updatedAt">): Promise<OpeningPosition> {
    const record = this.cache.createOpeningPosition(input);
    await this.pool.query(
      `INSERT INTO opening_positions(id, portfolio_id, account_id, investment_id, effective_date, quantity, currency, total_cost, created_at, updated_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [record.id, record.portfolioId, record.accountId, record.investmentId, record.effectiveDate, record.quantity, record.currency, record.totalCost, record.createdAt, record.updatedAt]);
    return record;
  }

  async createOperation(input: Parameters<FinanceStore["createOperation"]>[0]): Promise<Operation> {
    const existing = input.importSource && input.externalId ? this.cache.listOperations().find((item) =>
      item.importSource === input.importSource && item.accountId === input.accountId && item.externalId === input.externalId) : undefined;
    const record = this.cache.createOperation(input);
    if (existing) return record;
    await this.pool.query(
      `INSERT INTO operations(id, investment_id, account_id, destination_account_id, type, effective_date, quantity, price, currency, fees,
       ratio, bonus_total_cost, fractional_quantity, notes, import_source, external_id, payload_hash, version,
       reviewed_at, reviewed_by, review_notes, created_at, updated_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)`,
      [record.id, record.investmentId, record.accountId, record.destinationAccountId, record.type, record.effectiveDate, record.quantity,
       record.price, record.currency, record.fees, record.ratio, record.bonusTotalCost, record.fractionalQuantity, record.notes,
       record.importSource, record.externalId, record.payloadHash, record.version, record.reviewedAt, record.reviewedBy,
       record.reviewNotes, record.createdAt, record.updatedAt]);
    return record;
  }

  async reviseOperation(id: string, input: Parameters<FinanceStore["reviseOperation"]>[1]): Promise<Operation> {
    const updated = this.cache.reviseOperation(id, input);
    const revision = this.cache.listOperationRevisions(id).at(-1)!;
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        `UPDATE operations SET investment_id=$2, account_id=$3, destination_account_id=$4, type=$5, effective_date=$6,
         quantity=$7, price=$8, currency=$9, fees=$10, ratio=$11, bonus_total_cost=$12, fractional_quantity=$13, notes=$14,
         import_source=$15, external_id=$16, payload_hash=$17, version=$18, updated_at=$19
         WHERE id=$1 AND version=$20`,
        [id, updated.investmentId, updated.accountId, updated.destinationAccountId, updated.type, updated.effectiveDate,
         updated.quantity, updated.price, updated.currency, updated.fees, updated.ratio, updated.bonusTotalCost,
         updated.fractionalQuantity, updated.notes, updated.importSource, updated.externalId, updated.payloadHash,
         updated.version, updated.updatedAt, input.expectedVersion]);
      if (result.rowCount !== 1) throw new Error("Concurrent operation update");
      await client.query(
        `INSERT INTO operation_revisions(id, operation_id, version, actor, reason, before_data, after_data, created_at, updated_at)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [revision.id, id, revision.version, revision.actor, revision.reason, revision.before, revision.after, revision.createdAt, revision.updatedAt]);
      await client.query("COMMIT");
      return updated;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  }
  async markOperationReviewed(id: string, actor: string, notes?: string): Promise<Operation> {
    const updated = this.cache.markOperationReviewed(id, actor, notes);
    await this.pool.query("UPDATE operations SET reviewed_at=$2, reviewed_by=$3, review_notes=$4, updated_at=$5 WHERE id=$1",
      [id, updated.reviewedAt, actor, notes, updated.updatedAt]);
    return updated;
  }

  async createPrice(input: Omit<PriceObservation, "id" | "createdAt" | "updatedAt">): Promise<PriceObservation> {
    const record = this.cache.createPrice(input);
    await this.pool.query(
      "INSERT INTO price_observations(id, investment_id, effective_at, value, currency, source, created_at, updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
      [record.id, record.investmentId, record.effectiveAt, record.value, record.currency, record.source, record.createdAt, record.updatedAt]);
    return record;
  }
  async createFxRate(input: Omit<FxRate, "id" | "createdAt" | "updatedAt">): Promise<FxRate> {
    const record = this.cache.createFxRate(input);
    await this.pool.query(
      "INSERT INTO fx_rates(id, base_currency, quote_currency, effective_at, rate, source, created_at, updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
      [record.id, record.baseCurrency, record.quoteCurrency, record.effectiveAt, record.rate, record.source, record.createdAt, record.updatedAt]);
    return record;
  }

  async createStatement(input: Parameters<FinanceStore["createStatement"]>[0]): Promise<PortfolioStatement> {
    const existing = input.externalId ? this.cache.listStatements(input.accountId).find((item) => item.source === input.source && item.externalId === input.externalId) : undefined;
    const record = this.cache.createStatement(input);
    if (existing) return record;
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "INSERT INTO portfolio_statements(id, account_id, statement_date, source, external_id, created_at, updated_at) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [record.id, record.accountId, record.statementDate, record.source, record.externalId, record.createdAt, record.updatedAt]);
      for (const line of record.lines) await client.query(
        `INSERT INTO statement_lines(id, statement_id, investment_id, market, symbol, quantity, currency, total_cost, market_value, resolved)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [line.id, record.id, line.investmentId, line.market, line.symbol, line.quantity, line.currency, line.totalCost, line.marketValue, line.resolved]);
      await client.query("COMMIT");
      return record;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  }
  async reconcileStatement(statementId: string): Promise<Reconciliation> {
    const record = this.cache.reconcileStatement(statementId);
    await this.pool.query(
      "INSERT INTO reconciliations(id, statement_id, account_id, statement_date, status, results, created_at, updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
      [record.id, record.statementId, record.accountId, record.statementDate, record.status, JSON.stringify(record.results), record.createdAt, record.updatedAt]);
    return record;
  }

  async createNews(input: Omit<NewsItem, "id" | "createdAt" | "updatedAt">): Promise<NewsItem> {
    const record = this.cache.createNews(input);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO news_items(id, source, source_id, external_id, url, canonical_url, title, summary, body, published_at, retrieved_at,
         language, region, topic_tags, raw_hash, duplicate_group, processed_at, processed_by, processing_notes, created_at, updated_at)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
        [record.id, record.source, record.sourceId, record.externalId, record.url, record.canonicalUrl, record.title, record.summary, record.body,
         record.publishedAt, record.retrievedAt, record.language, record.region, JSON.stringify(record.topicTags), record.rawHash,
         record.duplicateGroup, record.processedAt, record.processedBy, record.processingNotes, record.createdAt, record.updatedAt]);
      for (const investmentId of record.relatedInvestmentIds) await client.query("INSERT INTO news_investments(news_id, investment_id) VALUES($1,$2)", [record.id, investmentId]);
      await client.query("COMMIT");
      await this.persistStoryGraph([...this.cache.newsStoryClusters.values()], [...this.cache.newsStoryMentions.values()]);
      return record;
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }
  async updateNews(id: string, patch: Partial<Omit<NewsItem, "id" | "createdAt" | "updatedAt">>): Promise<NewsItem> {
    await this.refreshNewsDomain();
    const updated = this.cache.updateNews(id, patch);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `UPDATE news_items SET source=$2, source_id=$3, external_id=$4, url=$5, canonical_url=$6, title=$7, summary=$8, body=$9,
         published_at=$10, retrieved_at=$11, language=$12, region=$13, topic_tags=$14, raw_hash=$15, duplicate_group=$16,
         processed_at=$17, processed_by=$18, processing_notes=$19, updated_at=$20 WHERE id=$1`,
        [id, updated.source, updated.sourceId, updated.externalId, updated.url, updated.canonicalUrl, updated.title, updated.summary,
         updated.body, updated.publishedAt, updated.retrievedAt, updated.language, updated.region, JSON.stringify(updated.topicTags),
         updated.rawHash, updated.duplicateGroup, updated.processedAt, updated.processedBy, updated.processingNotes, updated.updatedAt]);
      if (patch.relatedInvestmentIds) {
        await client.query("DELETE FROM news_investments WHERE news_id=$1", [id]);
        for (const investmentId of updated.relatedInvestmentIds) await client.query("INSERT INTO news_investments(news_id, investment_id) VALUES($1,$2)", [id, investmentId]);
      }
      await client.query("COMMIT");
      return updated;
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }
  async markNewsProcessed(id: string, actor: string, notes?: string): Promise<NewsItem> {
    await this.refreshNewsDomain();
    const updated = this.cache.markNewsProcessed(id, actor, notes);
    await this.pool.query("UPDATE news_items SET processed_at=$2, processed_by=$3, processing_notes=$4, updated_at=$5 WHERE id=$1",
      [id, updated.processedAt, actor, notes, updated.updatedAt]);
    return updated;
  }
  async createNewsSource(input: Omit<NewsSource, "id" | "createdAt" | "updatedAt">): Promise<NewsSource> {
    const record = this.cache.createNewsSource(input);
    await this.pool.query(
      `INSERT INTO news_sources(id, slug, name, adapter_type, endpoint, enabled, priority, editorial_type, language, region, access_tier,
       polling_interval_minutes, stale_after_minutes, overlap_minutes, request_timeout_ms, max_response_bytes, max_concurrency,
       secret_ref, config, disabled_reason, created_at, updated_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`,
      [record.id, record.slug, record.name, record.adapterType, record.endpoint, record.enabled, record.priority, record.editorialType,
       record.language, record.region, record.accessTier, record.pollingIntervalMinutes, record.staleAfterMinutes, record.overlapMinutes,
       record.requestTimeoutMs, record.maxResponseBytes, record.maxConcurrency, record.secretRef, record.config, record.disabledReason,
       record.createdAt, record.updatedAt]);
    await this.persistNewsSourceState(this.cache.getNewsSourceState(record.id));
    return record;
  }
  async updateNewsSource(id: string, patch: Partial<Omit<NewsSource, "id" | "createdAt" | "updatedAt">>): Promise<NewsSource> {
    const record = this.cache.updateNewsSource(id, patch);
    await this.pool.query(
      `UPDATE news_sources SET slug=$2, name=$3, adapter_type=$4, endpoint=$5, enabled=$6, priority=$7, editorial_type=$8,
       language=$9, region=$10, access_tier=$11, polling_interval_minutes=$12, stale_after_minutes=$13, overlap_minutes=$14,
       request_timeout_ms=$15, max_response_bytes=$16, max_concurrency=$17, secret_ref=$18, config=$19, disabled_reason=$20,
       updated_at=$21 WHERE id=$1`,
      [id, record.slug, record.name, record.adapterType, record.endpoint, record.enabled, record.priority, record.editorialType,
       record.language, record.region, record.accessTier, record.pollingIntervalMinutes, record.staleAfterMinutes, record.overlapMinutes,
       record.requestTimeoutMs, record.maxResponseBytes, record.maxConcurrency, record.secretRef, record.config, record.disabledReason,
       record.updatedAt]);
    return record;
  }
  async setNewsSourceState(sourceId: string, patch: Partial<NewsSourceState>): Promise<NewsSourceState> {
    const state = this.cache.setNewsSourceState(sourceId, patch);
    await this.persistNewsSourceState(state);
    return state;
  }
  async acquireNewsSourceLease(sourceId: string, owner: string, now: string, durationMs = 120_000): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE news_source_state SET lease_owner=$2, lease_expires_at=$3, updated_at=$4
       WHERE source_id=$1 AND (lease_expires_at IS NULL OR lease_expires_at <= $4 OR lease_owner=$2)`,
      [sourceId, owner, new Date(Date.parse(now) + durationMs).toISOString(), now]);
    if (result.rowCount !== 1) return false;
    this.cache.acquireNewsSourceLease(sourceId, owner, now, durationMs);
    return true;
  }
  async releaseNewsSourceLease(sourceId: string, owner: string): Promise<void> {
    await this.pool.query("UPDATE news_source_state SET lease_owner=NULL, lease_expires_at=NULL, updated_at=now() WHERE source_id=$1 AND lease_owner=$2", [sourceId, owner]);
    this.cache.releaseNewsSourceLease(sourceId, owner);
  }
  async createNewsCollectionRun(input: Omit<NewsCollectionRun, "id" | "createdAt" | "updatedAt">): Promise<NewsCollectionRun> {
    const record = this.cache.createNewsCollectionRun(input);
    await this.pool.query(
      `INSERT INTO news_collection_runs(id, source_id, trigger_type, window_from, window_to, status, started_at, completed_at,
       counts, diagnostics, error_code, created_at, updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [record.id, record.sourceId, record.trigger, record.windowFrom, record.windowTo, record.status, record.startedAt,
       record.completedAt, JSON.stringify(record.counts), JSON.stringify(record.diagnostics), record.errorCode,
       record.createdAt, record.updatedAt]);
    return record;
  }
  async updateNewsCollectionRun(id: string, patch: Partial<Omit<NewsCollectionRun, "id" | "createdAt" | "updatedAt">>): Promise<NewsCollectionRun> {
    const record = this.cache.updateNewsCollectionRun(id, patch);
    await this.pool.query(
      `UPDATE news_collection_runs SET status=$2, completed_at=$3, counts=$4, diagnostics=$5, error_code=$6, updated_at=$7 WHERE id=$1`,
      [id, record.status, record.completedAt, JSON.stringify(record.counts), JSON.stringify(record.diagnostics),
       record.errorCode, record.updatedAt]);
    return record;
  }
  async upsertCollectedNews(input: Parameters<FinanceStore["upsertCollectedNews"]>[0]): Promise<ReturnType<FinanceStore["upsertCollectedNews"]>> {
    const result = this.cache.upsertCollectedNews(input);
    if (result.result === "created") await this.persistNewsRecord(result.item);
    else if (result.result === "enriched") await this.updateNews(result.item.id, result.item);
    await this.persistStoryGraph([...this.cache.newsStoryClusters.values()], [...this.cache.newsStoryMentions.values()]);
    return result;
  }
  async createNewsClassification(newsId: string, input: NewsClassificationCreateInput):
  Promise<{ classification: NewsClassification; result: "created" | "replayed" }> {
    await this.refreshNewsDomain();
    const existing = this.cache.listNewsClassifications({ newsId, classifierId: input.classifierId, current: false, limit: 200 }).items
      .find((item) => item.externalRunId === input.externalRunId);
    const result = this.cache.createNewsClassification(newsId, input);
    if (existing) return result;
    const record = result.classification;
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO news_classifications(id, news_id, classifier_id, classifier_type, classifier_version, external_run_id,
         payload_hash, importance, scope, horizon, overall_confidence, tags, countries, currencies, sectors, evidence,
         supersedes_classification_id, created_at, updated_at)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
        [record.id, record.newsId, record.classifierId, record.classifierType, record.classifierVersion, record.externalRunId,
         record.payloadHash, record.importance, record.scope, record.horizon, record.overallConfidence, JSON.stringify(record.tags),
         JSON.stringify(record.countries), JSON.stringify(record.currencies), JSON.stringify(record.sectors), JSON.stringify(record.evidence),
         record.supersedesClassificationId, record.createdAt, record.updatedAt]);
      for (const target of record.targets) await client.query(
        `INSERT INTO news_classification_targets(id, classification_id, target_type, target_key, investment_id, company_name,
         market, symbol, direction, magnitude, confidence, rationale, evidence_keys)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [target.id, record.id, target.targetType, target.targetKey, target.investmentId, target.companyName, target.market,
         target.symbol, target.direction, target.magnitude, target.confidence, target.rationale, JSON.stringify(target.evidenceKeys)]);
      await client.query("COMMIT");
      await this.persistStoryGraph([...this.cache.newsStoryClusters.values()], [...this.cache.newsStoryMentions.values()]);
      return result;
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }
  async addClassificationReview(classificationId: string, input: ClassificationReviewCreateInput): Promise<ClassificationReview> {
    await this.refreshNewsDomain();
    const record = this.cache.addClassificationReview(classificationId, input);
    await this.pool.query(
      `INSERT INTO news_classification_reviews(id, classification_id, reviewer, decision, notes, created_at, updated_at)
       VALUES($1,$2,$3,$4,$5,$6,$7)`,
      [record.id, record.classificationId, record.reviewer, record.decision, record.notes, record.createdAt, record.updatedAt]);
    return record;
  }
  async resolveClassificationTarget(targetId: string, input: ClassificationResolutionCreateInput): Promise<ClassificationTargetResolution> {
    await this.refreshNewsDomain();
    const record = this.cache.resolveClassificationTarget(targetId, input);
    await this.pool.query(
      `INSERT INTO news_classification_target_resolutions(id, target_id, investment_id, actor, reason, created_at, updated_at)
       VALUES($1,$2,$3,$4,$5,$6,$7)`,
      [record.id, record.targetId, record.investmentId, record.actor, record.reason, record.createdAt, record.updatedAt]);
    return record;
  }
  private async persistNewsSourceState(state: NewsSourceState): Promise<void> {
    await this.pool.query(
      `INSERT INTO news_source_state(source_id, watermark, etag, last_modified, latest_item_at, last_attempt_at, last_success_at,
       consecutive_failures, next_poll_at, lease_owner, lease_expires_at, last_error_code, updated_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT(source_id) DO UPDATE SET watermark=EXCLUDED.watermark, etag=EXCLUDED.etag, last_modified=EXCLUDED.last_modified,
       latest_item_at=EXCLUDED.latest_item_at, last_attempt_at=EXCLUDED.last_attempt_at, last_success_at=EXCLUDED.last_success_at,
       consecutive_failures=EXCLUDED.consecutive_failures, next_poll_at=EXCLUDED.next_poll_at, lease_owner=EXCLUDED.lease_owner,
       lease_expires_at=EXCLUDED.lease_expires_at, last_error_code=EXCLUDED.last_error_code, updated_at=EXCLUDED.updated_at`,
      [state.sourceId, state.watermark, state.etag, state.lastModified, state.latestItemAt, state.lastAttemptAt, state.lastSuccessAt,
       state.consecutiveFailures, state.nextPollAt, state.leaseOwner, state.leaseExpiresAt, state.lastErrorCode, state.updatedAt]);
  }
  private async persistNewsRecord(record: NewsItem): Promise<void> {
    await this.pool.query(
      `INSERT INTO news_items(id, source, source_id, external_id, url, canonical_url, title, summary, body, published_at, retrieved_at,
       language, region, topic_tags, raw_hash, duplicate_group, processed_at, processed_by, processing_notes, created_at, updated_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
      [record.id, record.source, record.sourceId, record.externalId, record.url, record.canonicalUrl, record.title, record.summary,
       record.body, record.publishedAt, record.retrievedAt, record.language, record.region, JSON.stringify(record.topicTags), record.rawHash,
      record.duplicateGroup, record.processedAt, record.processedBy, record.processingNotes, record.createdAt, record.updatedAt]);
  }
  private async persistStoryGraph(stories: NewsStoryCluster[], mentions: NewsStoryMention[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      for (const story of stories) await client.query(
        `INSERT INTO news_story_clusters(id, publication_date, title, summary, primary_news_id, canonical_url, semantic_key, status,
         review_reason, classification_source, created_at, updated_at)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title, summary=EXCLUDED.summary, primary_news_id=EXCLUDED.primary_news_id,
         canonical_url=EXCLUDED.canonical_url, semantic_key=EXCLUDED.semantic_key, status=EXCLUDED.status,
         review_reason=EXCLUDED.review_reason, classification_source=EXCLUDED.classification_source, updated_at=EXCLUDED.updated_at`,
        [story.id, story.publicationDate, story.title, story.summary, story.primaryNewsId, story.canonicalUrl, story.semanticKey,
         story.status, story.reviewReason, JSON.stringify(story.classificationSource ?? { type: "none" }), story.createdAt, story.updatedAt]);
      for (const mention of mentions) await client.query(
        `INSERT INTO news_story_mentions(id, story_id, news_id, source_id, match_reason, confidence, is_primary, diagnostics, created_at, updated_at)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT(news_id) DO UPDATE SET story_id=EXCLUDED.story_id, source_id=EXCLUDED.source_id, match_reason=EXCLUDED.match_reason,
         confidence=EXCLUDED.confidence, is_primary=EXCLUDED.is_primary, diagnostics=EXCLUDED.diagnostics, updated_at=EXCLUDED.updated_at`,
        [mention.id, mention.storyId, mention.newsId, mention.sourceId, mention.matchReason, mention.confidence, mention.isPrimary,
         JSON.stringify(mention.diagnostics), mention.createdAt, mention.updatedAt]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  async createWatchedAsset(input: Omit<WatchedAsset, "id" | "createdAt" | "updatedAt">): Promise<WatchedAsset> {
    const record = this.cache.createWatchedAsset(input);
    await this.pool.query(
      "INSERT INTO watched_assets(id, symbol, name, asset_class, currency, market, country, active, created_at, updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
      [record.id, record.symbol, record.name, record.assetClass, record.currency, record.market, record.country, record.active, record.createdAt, record.updatedAt]);
    return record;
  }
  async createVirtualPortfolio(input: Omit<VirtualPortfolio, "id" | "createdAt" | "updatedAt">): Promise<VirtualPortfolio> {
    const record = this.cache.createVirtualPortfolio(input);
    await this.pool.query("INSERT INTO virtual_portfolios(id, name, description, created_at, updated_at) VALUES($1,$2,$3,$4,$5)",
      [record.id, record.name, record.description, record.createdAt, record.updatedAt]);
    return record;
  }
  async createVirtualPosition(portfolioId: string, input: Omit<Omit<VirtualPosition, "id" | "createdAt" | "updatedAt">, "virtualPortfolioId">): Promise<VirtualPosition> {
    const record = this.cache.createVirtualPosition(portfolioId, input);
    await this.pool.query(
      "INSERT INTO virtual_positions(id, virtual_portfolio_id, investment_id, quantity, target_weight, created_at, updated_at) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [record.id, record.virtualPortfolioId, record.investmentId, record.quantity, record.targetWeight, record.createdAt, record.updatedAt]);
    return record;
  }
  async createBenchmark(input: Omit<Benchmark, "id" | "createdAt" | "updatedAt">): Promise<Benchmark> {
    const record = this.cache.createBenchmark(input);
    await this.pool.query("INSERT INTO benchmarks(id, name, symbol, currency, source, created_at, updated_at) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [record.id, record.name, record.symbol, record.currency, record.source, record.createdAt, record.updatedAt]);
    return record;
  }
  async createBenchmarkObservation(input: Omit<BenchmarkObservation, "id" | "createdAt" | "updatedAt">): Promise<BenchmarkObservation> {
    const record = this.cache.createBenchmarkObservation(input);
    await this.pool.query(
      "INSERT INTO benchmark_observations(id, benchmark_id, effective_at, value, currency, source, created_at, updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
      [record.id, record.benchmarkId, record.effectiveAt, record.value, record.currency, record.source, record.createdAt, record.updatedAt]);
    return record;
  }
  async createSnapshot(input: Omit<PortfolioSnapshot, "id" | "createdAt" | "updatedAt">): Promise<PortfolioSnapshot> {
    const record = this.cache.createSnapshot(input);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("INSERT INTO portfolio_snapshots(id, captured_at, source, created_at, updated_at) VALUES($1,$2,$3,$4,$5)",
        [record.id, record.capturedAt, record.source, record.createdAt, record.updatedAt]);
      for (const position of record.positions) await client.query(
        "INSERT INTO snapshot_positions(snapshot_id, investment_id, quantity, currency) VALUES($1,$2,$3,$4)",
        [record.id, position.investmentId, position.quantity, position.currency]);
      await client.query("COMMIT");
      return record;
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }
}

async function applyMigrations(pool: pg.Pool): Promise<void> {
  await pool.query("CREATE TABLE IF NOT EXISTS schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())");
  const applied = new Set((await pool.query<{ filename: string }>("SELECT filename FROM schema_migrations")).rows.map((row) => row.filename));
  const files = (await readdir(join(process.cwd(), "migrations"))).filter((file) => file.endsWith(".sql")).sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(await readFile(join(process.cwd(), "migrations", file), "utf8"));
      await client.query("INSERT INTO schema_migrations(filename) VALUES($1)", [file]);
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }
}

async function loadCache(pool: pg.Pool): Promise<FinanceStore> {
  const cache = new FinanceStore();
  cache.portfolios.clear();
  cache.accounts.clear();
  for (const row of (await pool.query("SELECT * FROM portfolios")).rows) cache.portfolios.set(String(row.id), portfolioFromRow(row));
  for (const row of (await pool.query("SELECT * FROM brokerage_accounts")).rows) cache.accounts.set(String(row.id), accountFromRow(row));
  for (const row of (await pool.query("SELECT * FROM investments")).rows) cache.investments.set(String(row.id), investmentFromRow(row));
  for (const row of (await pool.query("SELECT * FROM opening_positions")).rows) cache.openingPositions.set(String(row.id), openingFromRow(row));
  for (const row of (await pool.query("SELECT * FROM operations")).rows) cache.operations.set(String(row.id), operationFromRow(row));
  for (const row of (await pool.query("SELECT * FROM operation_revisions")).rows) cache.operationRevisions.set(String(row.id), revisionFromRow(row));
  for (const row of (await pool.query("SELECT * FROM price_observations")).rows) cache.prices.set(String(row.id), priceFromRow(row));
  for (const row of (await pool.query("SELECT * FROM fx_rates")).rows) cache.fxRates.set(String(row.id), fxFromRow(row));

  const statementLines = new Map<string, PortfolioStatement["lines"]>();
  for (const row of (await pool.query("SELECT * FROM statement_lines")).rows) {
    const lines = statementLines.get(String(row.statement_id)) ?? [];
    lines.push({
      id: String(row.id), investmentId: optional(row.investment_id), market: optional(row.market), symbol: String(row.symbol),
      quantity: Number(row.quantity), currency: String(row.currency), totalCost: numeric(row.total_cost),
      marketValue: numeric(row.market_value), resolved: Boolean(row.resolved)
    });
    statementLines.set(String(row.statement_id), lines);
  }
  for (const row of (await pool.query("SELECT * FROM portfolio_statements")).rows) cache.statements.set(String(row.id), {
    id: String(row.id), accountId: String(row.account_id), statementDate: dateOnly(row.statement_date), source: String(row.source),
    externalId: optional(row.external_id), lines: statementLines.get(String(row.id)) ?? [], createdAt: iso(row.created_at), updatedAt: iso(row.updated_at)
  });
  for (const row of (await pool.query("SELECT * FROM reconciliations")).rows) cache.reconciliations.set(String(row.id), {
    id: String(row.id), statementId: String(row.statement_id), accountId: String(row.account_id), statementDate: dateOnly(row.statement_date),
    status: row.status as Reconciliation["status"], results: typeof row.results === "string" ? JSON.parse(row.results) : row.results,
    createdAt: iso(row.created_at), updatedAt: iso(row.updated_at)
  });

  for (const row of (await pool.query("SELECT * FROM news_sources")).rows) cache.newsSources.set(String(row.id), newsSourceFromRow(row));
  for (const row of (await pool.query("SELECT * FROM news_source_state")).rows) {
    cache.newsSourceStates.set(String(row.source_id), newsSourceStateFromRow(row));
  }
  for (const row of (await pool.query("SELECT * FROM news_collection_runs")).rows) {
    cache.newsCollectionRuns.set(String(row.id), newsCollectionRunFromRow(row));
  }
  await refreshNewsDomain(pool, cache);
  for (const row of (await pool.query("SELECT * FROM watched_assets")).rows) cache.watchedAssets.set(String(row.id), watchedFromRow(row));
  for (const row of (await pool.query("SELECT * FROM virtual_portfolios")).rows) cache.virtualPortfolios.set(String(row.id), virtualPortfolioFromRow(row));
  for (const row of (await pool.query("SELECT * FROM virtual_positions")).rows) cache.virtualPositions.set(String(row.id), virtualPositionFromRow(row));
  for (const row of (await pool.query("SELECT * FROM benchmarks")).rows) cache.benchmarks.set(String(row.id), benchmarkFromRow(row));
  for (const row of (await pool.query("SELECT * FROM benchmark_observations")).rows) {
    cache.benchmarkObservations.set(String(row.id), benchmarkObservationFromRow(row));
  }
  const snapshotPositions = new Map<string, PortfolioSnapshot["positions"]>();
  for (const row of (await pool.query("SELECT * FROM snapshot_positions")).rows) {
    const list = snapshotPositions.get(String(row.snapshot_id)) ?? [];
    list.push({ investmentId: String(row.investment_id), quantity: Number(row.quantity), currency: String(row.currency) });
    snapshotPositions.set(String(row.snapshot_id), list);
  }
  for (const row of (await pool.query("SELECT * FROM portfolio_snapshots")).rows) cache.snapshots.set(String(row.id), {
    id: String(row.id), capturedAt: iso(row.captured_at), source: optional(row.source), positions: snapshotPositions.get(String(row.id)) ?? [],
    createdAt: iso(row.created_at), updatedAt: iso(row.updated_at)
  });
  return cache;
}

async function refreshNewsDomain(pool: pg.Pool, cache: FinanceStore): Promise<void> {
  const client = await pool.connect();
  let linksResult;
  let newsResult;
  let targetsResult;
  let classificationsResult;
  let reviewsResult;
  let resolutionsResult;
  let storiesResult;
  let mentionsResult;
  try {
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    linksResult = await client.query("SELECT news_id, investment_id FROM news_investments");
    newsResult = await client.query("SELECT * FROM news_items");
    targetsResult = await client.query("SELECT * FROM news_classification_targets");
    classificationsResult = await client.query("SELECT * FROM news_classifications");
    reviewsResult = await client.query("SELECT * FROM news_classification_reviews");
    resolutionsResult = await client.query("SELECT * FROM news_classification_target_resolutions");
    storiesResult = await client.query("SELECT * FROM news_story_clusters");
    mentionsResult = await client.query("SELECT * FROM news_story_mentions");
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  const newsLinks = new Map<string, string[]>();
  for (const row of linksResult.rows) {
    const list = newsLinks.get(String(row.news_id)) ?? [];
    list.push(String(row.investment_id));
    newsLinks.set(String(row.news_id), list);
  }
  const news = new Map<string, NewsItem>();
  for (const row of newsResult.rows) news.set(String(row.id), newsFromRow(row, newsLinks.get(String(row.id)) ?? []));

  const classificationTargets = new Map<string, NewsClassification["targets"]>();
  for (const row of targetsResult.rows) {
    const list = classificationTargets.get(String(row.classification_id)) ?? [];
    list.push(classificationTargetFromRow(row));
    classificationTargets.set(String(row.classification_id), list);
  }
  const classifications = new Map<string, NewsClassification>();
  for (const row of classificationsResult.rows) {
    classifications.set(String(row.id), newsClassificationFromRow(row, classificationTargets.get(String(row.id)) ?? []));
  }
  const reviews = new Map<string, ClassificationReview>();
  for (const row of reviewsResult.rows) reviews.set(String(row.id), classificationReviewFromRow(row));
  const resolutions = new Map<string, ClassificationTargetResolution>();
  for (const row of resolutionsResult.rows) resolutions.set(String(row.id), classificationResolutionFromRow(row));
  const stories = new Map<string, NewsStoryCluster>();
  for (const row of storiesResult.rows) stories.set(String(row.id), newsStoryClusterFromRow(row));
  const mentions = new Map<string, NewsStoryMention>();
  for (const row of mentionsResult.rows) mentions.set(String(row.id), newsStoryMentionFromRow(row));

  cache.news.clear();
  news.forEach((value, key) => cache.news.set(key, value));
  cache.newsStoryClusters.clear();
  stories.forEach((value, key) => cache.newsStoryClusters.set(key, value));
  cache.newsStoryMentions.clear();
  mentions.forEach((value, key) => cache.newsStoryMentions.set(key, value));
  cache.newsClassifications.clear();
  classifications.forEach((value, key) => cache.newsClassifications.set(key, value));
  cache.classificationReviews.clear();
  reviews.forEach((value, key) => cache.classificationReviews.set(key, value));
  cache.classificationResolutions.clear();
  resolutions.forEach((value, key) => cache.classificationResolutions.set(key, value));
}

const iso = (value: unknown) => value instanceof Date ? value.toISOString() : String(value);
const dateOnly = (value: unknown) => iso(value).slice(0, 10);
const optional = (value: unknown) => value == null ? undefined : String(value);
const numeric = (value: unknown) => value == null ? undefined : Number(value);

function portfolioFromRow(row: Row): Portfolio {
  return { id: String(row.id), name: String(row.name), baseCurrency: String(row.base_currency), reliableFrom: dateOnly(row.reliable_from), createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) };
}
function accountFromRow(row: Row): BrokerageAccount {
  return { id: String(row.id), portfolioId: String(row.portfolio_id), name: String(row.name), institution: optional(row.institution), externalId: optional(row.external_id), active: Boolean(row.active), createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) };
}
function investmentFromRow(row: Row): Investment {
  return { id: String(row.id), symbol: String(row.symbol), name: String(row.name), assetClass: row.asset_class as Investment["assetClass"], currency: String(row.currency), market: String(row.market), isin: optional(row.isin), country: optional(row.country), broker: optional(row.broker), active: Boolean(row.active), createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) };
}
function openingFromRow(row: Row): OpeningPosition {
  return { id: String(row.id), portfolioId: String(row.portfolio_id), accountId: String(row.account_id), investmentId: String(row.investment_id), effectiveDate: dateOnly(row.effective_date), quantity: Number(row.quantity), currency: String(row.currency), totalCost: numeric(row.total_cost), createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) };
}
function operationFromRow(row: Row): Operation {
  return {
    id: String(row.id), investmentId: String(row.investment_id), accountId: String(row.account_id), destinationAccountId: optional(row.destination_account_id),
    type: row.type as Operation["type"], effectiveDate: dateOnly(row.effective_date), quantity: Number(row.quantity), price: numeric(row.price),
    currency: String(row.currency), fees: numeric(row.fees), ratio: numeric(row.ratio), bonusTotalCost: numeric(row.bonus_total_cost),
    fractionalQuantity: numeric(row.fractional_quantity), notes: optional(row.notes), importSource: optional(row.import_source),
    externalId: optional(row.external_id), payloadHash: optional(row.payload_hash), version: Number(row.version), reviewedAt: row.reviewed_at ? iso(row.reviewed_at) : undefined,
    reviewedBy: optional(row.reviewed_by), reviewNotes: optional(row.review_notes), createdAt: iso(row.created_at), updatedAt: iso(row.updated_at)
  };
}
function revisionFromRow(row: Row) {
  return { id: String(row.id), operationId: String(row.operation_id), version: Number(row.version), actor: String(row.actor), reason: String(row.reason), before: row.before_data as Operation, after: row.after_data as Operation, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) };
}
function priceFromRow(row: Row): PriceObservation {
  return { id: String(row.id), investmentId: String(row.investment_id), effectiveAt: iso(row.effective_at), value: Number(row.value), currency: String(row.currency), source: String(row.source), createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) };
}
function fxFromRow(row: Row): FxRate {
  return { id: String(row.id), baseCurrency: String(row.base_currency), quoteCurrency: String(row.quote_currency), effectiveAt: iso(row.effective_at), rate: Number(row.rate), source: String(row.source), createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) };
}
function newsFromRow(row: Row, relatedInvestmentIds: string[]): NewsItem {
  return {
    id: String(row.id), source: String(row.source), sourceId: optional(row.source_id), externalId: optional(row.external_id),
    url: optional(row.url), canonicalUrl: optional(row.canonical_url), title: String(row.title), summary: optional(row.summary),
    body: optional(row.body), publishedAt: iso(row.published_at), retrievedAt: row.retrieved_at ? iso(row.retrieved_at) : undefined,
    language: optional(row.language), region: optional(row.region), topicTags: jsonArray(row.topic_tags), rawHash: optional(row.raw_hash),
    duplicateGroup: optional(row.duplicate_group), relatedInvestmentIds, processedAt: row.processed_at ? iso(row.processed_at) : undefined,
    processedBy: optional(row.processed_by), processingNotes: optional(row.processing_notes), createdAt: iso(row.created_at), updatedAt: iso(row.updated_at)
  };
}
function newsStoryClusterFromRow(row: Row): NewsStoryCluster {
  return {
    id: String(row.id), publicationDate: dateOnly(row.publication_date), title: String(row.title),
    summary: optional(row.summary), primaryNewsId: String(row.primary_news_id), canonicalUrl: optional(row.canonical_url),
    semanticKey: optional(row.semantic_key), status: row.status as NewsStoryCluster["status"], reviewReason: optional(row.review_reason),
    classificationSource: jsonValue(row.classification_source, { type: "none" }), createdAt: iso(row.created_at), updatedAt: iso(row.updated_at)
  };
}
function newsStoryMentionFromRow(row: Row): NewsStoryMention {
  return {
    id: String(row.id), storyId: String(row.story_id), newsId: String(row.news_id), sourceId: optional(row.source_id),
    matchReason: row.match_reason as NewsStoryMention["matchReason"], confidence: Number(row.confidence), isPrimary: Boolean(row.is_primary),
    diagnostics: jsonArray(row.diagnostics), createdAt: iso(row.created_at), updatedAt: iso(row.updated_at)
  };
}
function newsSourceFromRow(row: Row): NewsSource {
  return {
    id: String(row.id), slug: String(row.slug), name: String(row.name), adapterType: row.adapter_type as NewsSource["adapterType"],
    endpoint: String(row.endpoint), enabled: Boolean(row.enabled), priority: row.priority as NewsSource["priority"],
    editorialType: row.editorial_type as NewsSource["editorialType"], language: optional(row.language), region: optional(row.region),
    accessTier: String(row.access_tier), pollingIntervalMinutes: Number(row.polling_interval_minutes),
    staleAfterMinutes: Number(row.stale_after_minutes), overlapMinutes: Number(row.overlap_minutes),
    requestTimeoutMs: Number(row.request_timeout_ms), maxResponseBytes: Number(row.max_response_bytes),
    maxConcurrency: Number(row.max_concurrency), secretRef: optional(row.secret_ref),
    config: (typeof row.config === "string" ? JSON.parse(row.config) : row.config ?? {}) as NewsSource["config"],
    disabledReason: optional(row.disabled_reason), createdAt: iso(row.created_at), updatedAt: iso(row.updated_at)
  };
}
function newsClassificationFromRow(row: Row, targets: NewsClassification["targets"]): NewsClassification {
  return {
    id: String(row.id), newsId: String(row.news_id), classifierId: String(row.classifier_id),
    classifierType: row.classifier_type as NewsClassification["classifierType"], classifierVersion: String(row.classifier_version),
    externalRunId: String(row.external_run_id), payloadHash: String(row.payload_hash),
    importance: row.importance as NewsClassification["importance"], scope: row.scope as NewsClassification["scope"],
    horizon: row.horizon as NewsClassification["horizon"], overallConfidence: Number(row.overall_confidence),
    tags: jsonArray(row.tags), countries: jsonArray(row.countries), currencies: jsonArray(row.currencies),
    sectors: jsonValue(row.sectors, []), evidence: jsonValue(row.evidence, []), targets,
    supersedesClassificationId: optional(row.supersedes_classification_id),
    createdAt: iso(row.created_at), updatedAt: iso(row.updated_at)
  };
}
function classificationTargetFromRow(row: Row): NewsClassification["targets"][number] {
  return {
    id: String(row.id), classificationId: String(row.classification_id),
    targetType: row.target_type as NewsClassification["targets"][number]["targetType"], targetKey: String(row.target_key),
    investmentId: optional(row.investment_id), companyName: optional(row.company_name), market: optional(row.market),
    symbol: optional(row.symbol), direction: row.direction as NewsClassification["targets"][number]["direction"],
    magnitude: row.magnitude as NewsClassification["targets"][number]["magnitude"], confidence: Number(row.confidence),
    rationale: String(row.rationale), evidenceKeys: jsonArray(row.evidence_keys)
  };
}
function classificationReviewFromRow(row: Row): ClassificationReview {
  return {
    id: String(row.id), classificationId: String(row.classification_id), reviewer: String(row.reviewer),
    decision: row.decision as ClassificationReview["decision"], notes: optional(row.notes),
    createdAt: iso(row.created_at), updatedAt: iso(row.updated_at)
  };
}
function classificationResolutionFromRow(row: Row): ClassificationTargetResolution {
  return {
    id: String(row.id), targetId: String(row.target_id), investmentId: String(row.investment_id),
    actor: String(row.actor), reason: String(row.reason), createdAt: iso(row.created_at), updatedAt: iso(row.updated_at)
  };
}
function newsSourceStateFromRow(row: Row): NewsSourceState {
  return {
    sourceId: String(row.source_id), watermark: row.watermark ? iso(row.watermark) : undefined, etag: optional(row.etag),
    lastModified: optional(row.last_modified), latestItemAt: row.latest_item_at ? iso(row.latest_item_at) : undefined,
    lastAttemptAt: row.last_attempt_at ? iso(row.last_attempt_at) : undefined, lastSuccessAt: row.last_success_at ? iso(row.last_success_at) : undefined,
    consecutiveFailures: Number(row.consecutive_failures), nextPollAt: row.next_poll_at ? iso(row.next_poll_at) : undefined,
    leaseOwner: optional(row.lease_owner), leaseExpiresAt: row.lease_expires_at ? iso(row.lease_expires_at) : undefined,
    lastErrorCode: optional(row.last_error_code), updatedAt: iso(row.updated_at)
  };
}
function newsCollectionRunFromRow(row: Row): NewsCollectionRun {
  return {
    id: String(row.id), sourceId: String(row.source_id), trigger: row.trigger_type as NewsCollectionRun["trigger"],
    windowFrom: iso(row.window_from), windowTo: iso(row.window_to), status: row.status as NewsCollectionRun["status"],
    startedAt: iso(row.started_at), completedAt: row.completed_at ? iso(row.completed_at) : undefined,
    counts: (typeof row.counts === "string" ? JSON.parse(row.counts) : row.counts) as NewsCollectionRun["counts"],
    diagnostics: jsonArray(row.diagnostics), errorCode: optional(row.error_code), createdAt: iso(row.created_at), updatedAt: iso(row.updated_at)
  };
}
function jsonArray(value: unknown): string[] {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  return Array.isArray(parsed) ? parsed.map(String) : [];
}
function jsonValue<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  return (typeof value === "string" ? JSON.parse(value) : value) as T;
}
function watchedFromRow(row: Row): WatchedAsset {
  return { id: String(row.id), symbol: String(row.symbol), name: String(row.name), assetClass: row.asset_class as WatchedAsset["assetClass"], currency: String(row.currency), market: optional(row.market), country: optional(row.country), active: Boolean(row.active), createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) };
}
function virtualPortfolioFromRow(row: Row): VirtualPortfolio {
  return { id: String(row.id), name: String(row.name), description: optional(row.description), createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) };
}
function virtualPositionFromRow(row: Row): VirtualPosition {
  return { id: String(row.id), virtualPortfolioId: String(row.virtual_portfolio_id), investmentId: String(row.investment_id), quantity: Number(row.quantity), targetWeight: numeric(row.target_weight), createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) };
}
function benchmarkFromRow(row: Row): Benchmark {
  return { id: String(row.id), name: String(row.name), symbol: String(row.symbol), currency: String(row.currency), source: optional(row.source), createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) };
}
function benchmarkObservationFromRow(row: Row): BenchmarkObservation {
  return {
    id: String(row.id), benchmarkId: String(row.benchmark_id), effectiveAt: iso(row.effective_at),
    value: Number(row.value), currency: String(row.currency), source: String(row.source),
    createdAt: iso(row.created_at), updatedAt: iso(row.updated_at)
  };
}
