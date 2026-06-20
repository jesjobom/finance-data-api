import { createHash } from "node:crypto";
import {
  type Benchmark,
  type BenchmarkObservation,
  type BrokerageAccount,
  canonicalOperationPayload,
  type FxRate,
  type Investment,
  type NewsItem,
  type OpeningPosition,
  type Operation,
  type OperationRevision,
  type Portfolio,
  type PortfolioSnapshot,
  type PortfolioStatement,
  type PriceObservation,
  type Reconciliation,
  type ReconciliationResult,
  type StatementLine,
  type VirtualPortfolio,
  type VirtualPosition,
  type WatchedAsset,
  newId,
  nowIso,
  operationCreateSchema
} from "./domain.js";
import { conflict, notFound, validation } from "./errors.js";

type Create<T extends { id: string; createdAt: string; updatedAt: string }> = Omit<T, "id" | "createdAt" | "updatedAt">;
type Patch<T> = Partial<Omit<T, "id" | "createdAt" | "updatedAt">>;

export type ChangeRecord = { type: string; id: string; updatedAt: string };

type PositionState = {
  investmentId: string;
  accountId: string;
  quantity: number;
  knownCost: number;
  unknownCostQuantity: number;
};

export class FinanceStore {
  readonly portfolios = new Map<string, Portfolio>();
  readonly accounts = new Map<string, BrokerageAccount>();
  readonly investments = new Map<string, Investment>();
  readonly openingPositions = new Map<string, OpeningPosition>();
  readonly operations = new Map<string, Operation>();
  readonly operationRevisions = new Map<string, OperationRevision>();
  readonly prices = new Map<string, PriceObservation>();
  readonly fxRates = new Map<string, FxRate>();
  readonly statements = new Map<string, PortfolioStatement>();
  readonly reconciliations = new Map<string, Reconciliation>();
  readonly news = new Map<string, NewsItem>();
  readonly watchedAssets = new Map<string, WatchedAsset>();
  readonly virtualPortfolios = new Map<string, VirtualPortfolio>();
  readonly virtualPositions = new Map<string, VirtualPosition>();
  readonly benchmarks = new Map<string, Benchmark>();
  readonly benchmarkObservations = new Map<string, BenchmarkObservation>();
  readonly snapshots = new Map<string, PortfolioSnapshot>();

  constructor() {
    const timestamp = nowIso();
    this.portfolios.set("portfolio_default", {
      id: "portfolio_default", name: "Default Portfolio", baseCurrency: "USD",
      reliableFrom: "1900-01-01", createdAt: timestamp, updatedAt: timestamp
    });
    this.accounts.set("account_default", {
      id: "account_default", portfolioId: "portfolio_default", name: "Default Account",
      active: true, createdAt: timestamp, updatedAt: timestamp
    });
  }

  getPortfolio(id = "portfolio_default"): Portfolio { return this.get(this.portfolios, "portfolio", id); }
  updatePortfolio(id: string, patch: Patch<Portfolio>): Portfolio {
    return this.update(this.portfolios, "portfolio", id, patch);
  }

  createAccount(input: Create<BrokerageAccount>): BrokerageAccount {
    this.getPortfolio(input.portfolioId);
    if (input.externalId && [...this.accounts.values()].some((item) => item.portfolioId === input.portfolioId && item.externalId === input.externalId)) {
      throw conflict("Brokerage account externalId already exists in portfolio", { portfolioId: input.portfolioId, externalId: input.externalId });
    }
    return this.insert(this.accounts, "account", { ...input, active: input.active ?? true });
  }
  listAccounts(portfolioId?: string): BrokerageAccount[] {
    return [...this.accounts.values()].filter((item) => !portfolioId || item.portfolioId === portfolioId)
      .sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
  }
  getAccount(id: string): BrokerageAccount { return this.get(this.accounts, "brokerage account", id); }

  createInvestment(input: Create<Investment>): Investment {
    const market = input.market.toUpperCase();
    const symbol = input.symbol.toUpperCase();
    const existing = [...this.investments.values()].find((item) => item.active && item.market === market && item.symbol === symbol);
    if (existing) throw conflict("Asset already exists for market and symbol", { id: existing.id, market, symbol });
    return this.insert(this.investments, "inv", { ...input, market, symbol, active: input.active ?? true });
  }
  listInvestments(): Investment[] {
    return [...this.investments.values()].sort((left, right) => left.market.localeCompare(right.market) || left.symbol.localeCompare(right.symbol));
  }
  getInvestment(id: string): Investment { return this.get(this.investments, "investment", id); }
  updateInvestment(id: string, patch: Patch<Investment>): Investment {
    const current = this.getInvestment(id);
    const market = (patch.market ?? current.market).toUpperCase();
    const symbol = (patch.symbol ?? current.symbol).toUpperCase();
    const duplicate = [...this.investments.values()].find((item) => item.id !== id && item.active && item.market === market && item.symbol === symbol);
    if (duplicate) throw conflict("Asset already exists for market and symbol", { id: duplicate.id, market, symbol });
    return this.update(this.investments, "investment", id, { ...patch, market, symbol });
  }
  deactivateInvestment(id: string): Investment { return this.updateInvestment(id, { active: false }); }

  createOpeningPosition(input: Create<OpeningPosition>): OpeningPosition {
    const portfolio = this.getPortfolio(input.portfolioId);
    const account = this.getAccount(input.accountId);
    this.requireInvestment(input.investmentId);
    if (account.portfolioId !== portfolio.id) throw validation("Account does not belong to portfolio");
    if (input.effectiveDate !== portfolio.reliableFrom) {
      throw validation("Opening position effectiveDate must equal portfolio reliableFrom", { reliableFrom: portfolio.reliableFrom });
    }
    const duplicate = [...this.openingPositions.values()].find((item) =>
      item.portfolioId === input.portfolioId && item.accountId === input.accountId && item.investmentId === input.investmentId);
    if (duplicate) throw conflict("Opening position already exists", { id: duplicate.id });
    return this.insert(this.openingPositions, "open", input);
  }
  listOpeningPositions(portfolioId = "portfolio_default"): OpeningPosition[] {
    return [...this.openingPositions.values()].filter((item) => item.portfolioId === portfolioId)
      .sort((left, right) => left.accountId.localeCompare(right.accountId) || left.investmentId.localeCompare(right.investmentId));
  }

  createOperation(input: Omit<Create<Operation>, "version" | "payloadHash"> & Partial<Pick<Operation, "version" | "payloadHash">>): Operation {
    this.requireInvestment(input.investmentId);
    this.getAccount(input.accountId);
    if (input.destinationAccountId) this.getAccount(input.destinationAccountId);
    if (input.type === "transfer" && input.accountId === input.destinationAccountId) throw validation("Transfer accounts must differ");

    const payloadHash = hashOperation(input as Record<string, unknown>);
    if (input.importSource && input.externalId) {
      const existing = [...this.operations.values()].find((item) =>
        item.importSource === input.importSource && item.accountId === input.accountId && item.externalId === input.externalId);
      if (existing) {
        if (existing.payloadHash === payloadHash) return existing;
        throw conflict("Import identity already exists with different factual content", {
          importSource: input.importSource, accountId: input.accountId, externalId: input.externalId, operationId: existing.id
        });
      }
    }
    const record = this.insert(this.operations, "op", { ...input, payloadHash, version: input.version ?? 1 } as Create<Operation>);
    try {
      this.assertCalculatedState("9999-12-31");
      return record;
    } catch (error) {
      this.operations.delete(record.id);
      throw error;
    }
  }

  getOperation(id: string): Operation { return this.get(this.operations, "operation", id); }
  listOperations(investmentId?: string): Operation[] {
    return [...this.operations.values()].filter((item) => !investmentId || item.investmentId === investmentId)
      .sort((left, right) => left.effectiveDate.localeCompare(right.effectiveDate) || left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
  }

  reviseOperation(id: string, input: { actor: string; reason: string; expectedVersion: number; changes: Partial<Operation> }): Operation {
    const current = this.getOperation(id);
    if (current.version !== input.expectedVersion) throw conflict("Operation version is stale", { expectedVersion: input.expectedVersion, actualVersion: current.version });
    const immutable = new Set(["id", "createdAt", "updatedAt", "reviewedAt", "reviewedBy", "reviewNotes", "version", "payloadHash"]);
    const changes = Object.fromEntries(Object.entries(input.changes).filter(([key, value]) => value !== undefined && !immutable.has(key))) as Partial<Operation>;
    const parsed = operationCreateSchema.parse({ ...current, ...changes });
    const after = { ...current, ...parsed, id, version: current.version + 1, updatedAt: nowIso() };
    this.requireInvestment(after.investmentId);
    this.getAccount(after.accountId);
    if (after.destinationAccountId) this.getAccount(after.destinationAccountId);
    after.payloadHash = hashOperation(after as unknown as Record<string, unknown>);
    const revision = this.insert(this.operationRevisions, "rev", {
      operationId: id, version: after.version, actor: input.actor, reason: input.reason, before: current, after
    });
    this.operations.set(id, after);
    try {
      this.assertCalculatedState("9999-12-31");
    } catch (error) {
      this.operations.set(id, current);
      this.operationRevisions.delete(revision.id);
      throw error;
    }
    return after;
  }
  listOperationRevisions(operationId: string): OperationRevision[] {
    this.getOperation(operationId);
    return [...this.operationRevisions.values()].filter((item) => item.operationId === operationId).sort((a, b) => a.version - b.version);
  }
  markOperationReviewed(id: string, actor: string, notes?: string): Operation {
    return this.update(this.operations, "operation", id, { reviewedAt: nowIso(), reviewedBy: actor, reviewNotes: notes });
  }

  createPrice(input: Create<PriceObservation>): PriceObservation {
    this.requireInvestment(input.investmentId);
    return this.insert(this.prices, "price", input);
  }
  listPrices(investmentId?: string): PriceObservation[] {
    return [...this.prices.values()].filter((item) => !investmentId || item.investmentId === investmentId)
      .sort((a, b) => a.effectiveAt.localeCompare(b.effectiveAt) || a.source.localeCompare(b.source) || a.id.localeCompare(b.id));
  }
  createFxRate(input: Create<FxRate>): FxRate { return this.insert(this.fxRates, "fx", input); }
  listFxRates(baseCurrency?: string, quoteCurrency?: string): FxRate[] {
    return [...this.fxRates.values()].filter((item) =>
      (!baseCurrency || item.baseCurrency === baseCurrency) && (!quoteCurrency || item.quoteCurrency === quoteCurrency))
      .sort((a, b) => a.effectiveAt.localeCompare(b.effectiveAt) || a.source.localeCompare(b.source) || a.id.localeCompare(b.id));
  }

  createStatement(input: Omit<Create<PortfolioStatement>, "lines"> & { lines: Array<Omit<StatementLine, "id" | "resolved">> }): PortfolioStatement {
    this.getAccount(input.accountId);
    if (input.externalId) {
      const existing = [...this.statements.values()].find((item) =>
        item.source === input.source && item.accountId === input.accountId && item.externalId === input.externalId);
      if (existing) return existing;
    }
    const lines = input.lines.map((line) => {
      const investment = line.investmentId ? this.investments.get(line.investmentId) :
        [...this.investments.values()].find((item) => item.market === line.market?.toUpperCase() && item.symbol === line.symbol.toUpperCase());
      return { ...line, id: newId("line"), investmentId: investment?.id, market: line.market?.toUpperCase(), symbol: line.symbol.toUpperCase(), resolved: Boolean(investment) };
    });
    return this.insert(this.statements, "stmt", { ...input, lines });
  }
  getStatement(id: string): PortfolioStatement { return this.get(this.statements, "statement", id); }
  listStatements(accountId?: string): PortfolioStatement[] {
    return [...this.statements.values()].filter((item) => !accountId || item.accountId === accountId)
      .sort((a, b) => a.statementDate.localeCompare(b.statementDate) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  }

  reconcileStatement(statementId: string): Reconciliation {
    const statement = this.getStatement(statementId);
    const ledger = this.positionStates(statement.statementDate).filter((item) => item.accountId === statement.accountId && item.quantity > 0);
    const ledgerByInvestment = new Map(ledger.map((item) => [item.investmentId, item]));
    const used = new Set<string>();
    const results: ReconciliationResult[] = [];
    for (const line of statement.lines) {
      if (!line.investmentId) {
        results.push({
          market: line.market ?? "UNKNOWN", symbol: line.symbol, reportedQuantity: line.quantity, calculatedQuantity: 0,
          quantityDifference: -line.quantity, status: "unresolved", reportedCost: line.totalCost, costAvailable: false,
          reportedMarketValue: line.marketValue, marketValueAvailable: false
        });
        continue;
      }
      used.add(line.investmentId);
      const asset = this.requireInvestment(line.investmentId);
      const calculated = ledgerByInvestment.get(line.investmentId);
      const calculatedQuantity = calculated?.quantity ?? 0;
      const difference = calculatedQuantity - line.quantity;
      const status = calculated ? (nearZero(difference) ? "matched" : "discrepancy") : "statement_only";
      const costFx = line.currency === asset.currency ? undefined : this.selectFx(asset.currency, line.currency, statement.statementDate);
      const costAvailable = line.totalCost !== undefined && calculated !== undefined && calculated.unknownCostQuantity === 0 &&
        (line.currency === asset.currency || Boolean(costFx));
      const calculatedCost = costAvailable ? calculated!.knownCost * (costFx?.rate ?? 1) : undefined;
      const valuePrice = this.selectPrice(asset.id, statement.statementDate);
      const valueFx = valuePrice && valuePrice.currency !== line.currency
        ? this.selectFx(valuePrice.currency, line.currency, statement.statementDate)
        : undefined;
      const marketValueAvailable = line.marketValue !== undefined && calculated !== undefined && valuePrice !== undefined &&
        (valuePrice.currency === line.currency || Boolean(valueFx));
      const calculatedMarketValue = marketValueAvailable
        ? calculated!.quantity * valuePrice!.value * (valueFx?.rate ?? 1)
        : undefined;
      results.push({
        investmentId: asset.id, market: asset.market, symbol: asset.symbol, reportedQuantity: line.quantity,
        calculatedQuantity, quantityDifference: difference, status, reportedCost: line.totalCost,
        calculatedCost: calculatedCost === undefined ? undefined : clean(calculatedCost),
        costDifference: calculatedCost === undefined ? undefined : clean(calculatedCost - line.totalCost!),
        costAvailable, costFxObservationId: costFx?.observation.id, costFxInverted: costFx?.inverted,
        reportedMarketValue: line.marketValue,
        calculatedMarketValue: calculatedMarketValue === undefined ? undefined : clean(calculatedMarketValue),
        marketValueDifference: calculatedMarketValue === undefined ? undefined : clean(calculatedMarketValue - line.marketValue!),
        marketValueAvailable, valuePriceObservationId: valuePrice?.id,
        valueFxObservationId: valueFx?.observation.id, valueFxInverted: valueFx?.inverted
      });
    }
    for (const calculated of ledger) {
      if (used.has(calculated.investmentId)) continue;
      const asset = this.requireInvestment(calculated.investmentId);
      results.push({
        investmentId: asset.id, market: asset.market, symbol: asset.symbol, reportedQuantity: 0,
        calculatedQuantity: calculated.quantity, quantityDifference: calculated.quantity, status: "ledger_only",
        calculatedCost: calculated.unknownCostQuantity === 0 ? calculated.knownCost : undefined,
        costAvailable: false, marketValueAvailable: false
      });
    }
    results.sort((a, b) => a.market.localeCompare(b.market) || a.symbol.localeCompare(b.symbol));
    return this.insert(this.reconciliations, "rec", {
      statementId, accountId: statement.accountId, statementDate: statement.statementDate,
      status: results.every((item) => item.status === "matched") ? "matched" : "discrepancies", results
    });
  }
  getReconciliation(id: string): Reconciliation { return this.get(this.reconciliations, "reconciliation", id); }
  listReconciliations(accountId?: string): Reconciliation[] {
    return [...this.reconciliations.values()].filter((item) => !accountId || item.accountId === accountId)
      .sort((a, b) => a.statementDate.localeCompare(b.statementDate) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  }

  currentPortfolio(asOf?: string, accountId?: string): PortfolioPosition[] {
    const portfolio = this.getPortfolio();
    const date = asOf ?? "9999-12-31";
    if (date < portfolio.reliableFrom) throw validation("Requested date is before reliable portfolio history", { reliableFrom: portfolio.reliableFrom });
    return this.positionStates(date).filter((state) => state.quantity > 0 && (!accountId || state.accountId === accountId))
      .map((state) => {
        const investment = this.requireInvestment(state.investmentId);
        return {
          investment, accountId: state.accountId, quantity: clean(state.quantity),
          totalCost: state.unknownCostQuantity === 0 ? clean(state.knownCost) : undefined,
          costStatus: state.unknownCostQuantity === 0 ? "known" as const : state.knownCost > 0 ? "partial" as const : "unknown" as const,
          unknownCostQuantity: clean(state.unknownCostQuantity), reliableFrom: portfolio.reliableFrom, reliable: true
        };
      }).sort((a, b) => a.investment.market.localeCompare(b.investment.market) || a.investment.symbol.localeCompare(b.investment.symbol) || a.accountId.localeCompare(b.accountId));
  }

  valuedPortfolio(asOf: string, source?: string): ValuedPosition[] {
    const portfolio = this.getPortfolio();
    return this.currentPortfolio(asOf).map((position) => {
      const price = this.selectPrice(position.investment.id, asOf, source);
      if (!price) return {
        ...position, baseCurrency: portfolio.baseCurrency, valuationStatus: "unavailable",
        missing: { type: "price", severity: "required", investmentId: position.investment.id, date: asOf, source },
        completeness: { status: "unavailable", diagnostics: [{ type: "price", severity: "required", investmentId: position.investment.id, date: asOf, source }] }
      };
      const originalValue = position.quantity * price.value;
      if (price.currency === portfolio.baseCurrency) {
        return {
          ...position, baseCurrency: portfolio.baseCurrency, valuationStatus: "available",
          originalValue: clean(originalValue), baseValue: clean(originalValue), price,
          originalGainLoss: position.totalCost !== undefined && price.currency === position.investment.currency ? clean(originalValue - position.totalCost) : undefined,
          completeness: { status: "complete", diagnostics: [] }
        };
      }
      const fx = this.selectFx(price.currency, portfolio.baseCurrency, asOf, source);
      if (!fx) return {
        ...position, baseCurrency: portfolio.baseCurrency, valuationStatus: "unavailable", originalValue: clean(originalValue), price,
        missing: { type: "fx", severity: "required", baseCurrency: price.currency, quoteCurrency: portfolio.baseCurrency, date: asOf, source },
        completeness: {
          status: "unavailable",
          diagnostics: [{ type: "fx", severity: "required", baseCurrency: price.currency, quoteCurrency: portfolio.baseCurrency, date: asOf, source }]
        }
      };
      return {
        ...position, baseCurrency: portfolio.baseCurrency, valuationStatus: "available", originalValue: clean(originalValue),
        baseValue: clean(originalValue * fx.rate), price, fx: fx.observation, fxInverted: fx.inverted,
        originalGainLoss: position.totalCost !== undefined && price.currency === position.investment.currency ? clean(originalValue - position.totalCost) : undefined,
        completeness: { status: "complete", diagnostics: [] }
      };
    });
  }

  valuedAllocations(by: "asset" | "assetClass" | "currency" | "country" | "market" | "broker" | "account", asOf: string, source?: string): ValuedAllocation[] {
    const groups = new Map<string, ValuedAllocation>();
    const positions = this.valuedPortfolio(asOf, source);
    const total = positions.filter((item) => item.valuationStatus === "available").reduce((sum, item) => sum + (item.baseValue ?? 0), 0);
    const hasUnavailable = positions.some((item) => item.valuationStatus === "unavailable");
    const diagnostics = positions.flatMap((item) => item.completeness.diagnostics);
    const overallCompleteness = completeness(diagnostics, [hasUnavailable ? undefined : total]);
    for (const position of positions) {
      const account = this.getAccount(position.accountId);
      const key = by === "asset" ? position.investment.id
        : by === "account" ? position.accountId
        : by === "broker" ? String(account.institution ?? account.name)
        : String(position.investment[by] ?? "unknown");
      const group = groups.get(key) ?? {
        key, baseCurrency: position.baseCurrency, baseValue: 0,
        unavailablePositions: [] as ValuedAllocation["unavailablePositions"],
        completeness: { status: "complete" as const, diagnostics: [] }
      };
      if (position.valuationStatus === "available") group.baseValue = clean(group.baseValue + (position.baseValue ?? 0));
      else group.unavailablePositions.push({ investmentId: position.investment.id, missing: position.missing });
      groups.set(key, group);
    }
    return [...groups.values()].map((group) => ({
      ...group,
      weight: !hasUnavailable && total > 0 ? clean(group.baseValue / total) : undefined,
      completeness: overallCompleteness
    })).sort((a, b) => a.key.localeCompare(b.key));
  }

  allocations(by: "asset" | "assetClass" | "currency" | "country" | "market" | "broker" | "account"): Allocation[] {
    const groups = new Map<string, number>();
    for (const position of this.currentPortfolio()) {
      const account = this.getAccount(position.accountId);
      const key = by === "asset" ? position.investment.id
        : by === "account" ? position.accountId
        : by === "broker" ? String(account.institution ?? account.name)
        : String(position.investment[by] ?? "unknown");
      groups.set(key, (groups.get(key) ?? 0) + position.quantity);
    }
    return [...groups.entries()].map(([key, quantity]) => ({ key, quantity: clean(quantity) })).sort((a, b) => a.key.localeCompare(b.key));
  }

  createNews(input: Create<NewsItem>): NewsItem {
    for (const id of input.relatedInvestmentIds) this.requireInvestment(id);
    return this.insert(this.news, "news", input);
  }
  getNews(id: string): NewsItem { return this.get(this.news, "news", id); }
  updateNews(id: string, patch: Patch<NewsItem>): NewsItem {
    if (patch.relatedInvestmentIds) for (const investmentId of patch.relatedInvestmentIds) this.requireInvestment(investmentId);
    return this.update(this.news, "news", id, patch);
  }
  markNewsProcessed(id: string, actor: string, notes?: string): NewsItem {
    return this.update(this.news, "news", id, { processedAt: nowIso(), processedBy: actor, processingNotes: notes });
  }
  listNews(filters: { date?: string; from?: string; to?: string; investmentId?: string; watched?: boolean; unprocessed?: boolean } = {}): NewsItem[] {
    const heldIds = new Set(this.currentPortfolio().map((position) => position.investment.id));
    const watchedKeys = new Set([...this.watchedAssets.values()].map((asset) => `${asset.market ?? ""}:${asset.symbol}`));
    const watchedIds = new Set([...this.investments.values()].filter((asset) => watchedKeys.has(`${asset.market}:${asset.symbol}`)).map((asset) => asset.id));
    return [...this.news.values()]
      .filter((item) => !filters.unprocessed || !item.processedAt)
      .filter((item) => !filters.date || item.publishedAt.startsWith(filters.date))
      .filter((item) => !filters.from || item.publishedAt >= filters.from)
      .filter((item) => !filters.to || item.publishedAt <= filters.to)
      .filter((item) => !filters.investmentId || item.relatedInvestmentIds.includes(filters.investmentId))
      .filter((item) => !filters.watched || item.relatedInvestmentIds.some((id) => heldIds.has(id) || watchedIds.has(id)))
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.id.localeCompare(b.id));
  }

  createWatchedAsset(input: Create<WatchedAsset>): WatchedAsset { return this.insert(this.watchedAssets, "watch", { ...input, active: input.active ?? true }); }
  listWatchedAssets(): WatchedAsset[] { return [...this.watchedAssets.values()].sort((a, b) => a.symbol.localeCompare(b.symbol)); }
  createVirtualPortfolio(input: Create<VirtualPortfolio>): VirtualPortfolio { return this.insert(this.virtualPortfolios, "vp", input); }
  listVirtualPortfolios(): VirtualPortfolio[] { return [...this.virtualPortfolios.values()].sort((a, b) => a.name.localeCompare(b.name)); }
  createVirtualPosition(virtualPortfolioId: string, input: Omit<Create<VirtualPosition>, "virtualPortfolioId">): VirtualPosition {
    this.get(this.virtualPortfolios, "virtual portfolio", virtualPortfolioId);
    this.requireInvestment(input.investmentId);
    return this.insert(this.virtualPositions, "vpos", { ...input, virtualPortfolioId });
  }
  createBenchmark(input: Create<Benchmark>): Benchmark { return this.insert(this.benchmarks, "bench", input); }
  listBenchmarks(): Benchmark[] { return [...this.benchmarks.values()].sort((a, b) => a.name.localeCompare(b.name)); }
  createBenchmarkObservation(input: Create<BenchmarkObservation>): BenchmarkObservation {
    this.get(this.benchmarks, "benchmark", input.benchmarkId);
    return this.insert(this.benchmarkObservations, "benchobs", input);
  }
  listBenchmarkObservations(benchmarkId?: string): BenchmarkObservation[] {
    return [...this.benchmarkObservations.values()]
      .filter((item) => !benchmarkId || item.benchmarkId === benchmarkId)
      .sort((a, b) => a.effectiveAt.localeCompare(b.effectiveAt) || a.source.localeCompare(b.source) || a.id.localeCompare(b.id));
  }
  createSnapshot(input: Create<PortfolioSnapshot>): PortfolioSnapshot {
    for (const position of input.positions) this.requireInvestment(position.investmentId);
    return this.insert(this.snapshots, "snap", input);
  }
  latestSnapshot(): PortfolioSnapshot | undefined { return [...this.snapshots.values()].sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))[0]; }

  dailyPackage(date: string): DailyPackage {
    return { date, currentPortfolio: this.currentPortfolio(), news: this.listNews({ date }), recentOperations: this.listOperations().filter((item) => item.effectiveDate <= date).slice(-20), pending: this.pendingWork() };
  }
  changesSince(cursor?: string): { cursor: string; changes: ChangeRecord[] } {
    const since = cursor ?? "";
    const sources: Array<[string, Map<string, { id: string; updatedAt: string }>]> = [
      ["portfolio", this.portfolios], ["account", this.accounts], ["investment", this.investments], ["openingPosition", this.openingPositions],
      ["operation", this.operations], ["operationRevision", this.operationRevisions], ["price", this.prices], ["fxRate", this.fxRates],
      ["statement", this.statements], ["reconciliation", this.reconciliations], ["news", this.news], ["watchedAsset", this.watchedAssets],
      ["virtualPortfolio", this.virtualPortfolios], ["virtualPosition", this.virtualPositions], ["benchmark", this.benchmarks],
      ["benchmarkObservation", this.benchmarkObservations], ["snapshot", this.snapshots]
    ];
    const changes = sources.flatMap(([type, map]) => [...map.values()].map((record) => ({ type, id: record.id, updatedAt: record.updatedAt })))
      .filter((item) => item.updatedAt > since).sort((a, b) => a.updatedAt.localeCompare(b.updatedAt) || a.id.localeCompare(b.id));
    return { cursor: nowIso(), changes };
  }
  compareVirtualPortfolio(virtualPortfolioId: string): VirtualComparison[] {
    this.get(this.virtualPortfolios, "virtual portfolio", virtualPortfolioId);
    const real = new Map<string, number>();
    for (const position of this.currentPortfolio()) real.set(position.investment.id, (real.get(position.investment.id) ?? 0) + position.quantity);
    const virtual = new Map([...this.virtualPositions.values()].filter((item) => item.virtualPortfolioId === virtualPortfolioId).map((item) => [item.investmentId, item.quantity]));
    return [...new Set([...real.keys(), ...virtual.keys()])].map((investmentId) => ({
      investment: this.requireInvestment(investmentId), realQuantity: real.get(investmentId) ?? 0,
      virtualQuantity: virtual.get(investmentId) ?? 0, quantityDifference: (virtual.get(investmentId) ?? 0) - (real.get(investmentId) ?? 0)
    })).sort((a, b) => a.investment.symbol.localeCompare(b.investment.symbol));
  }
  pendingWork(): PendingWork {
    const latestSnapshot = this.latestSnapshot();
    return {
      news: [...this.news.values()].filter((item) => !item.processedAt).map(({ id, title, publishedAt }) => ({ id, title, publishedAt })),
      operations: [...this.operations.values()].filter((item) => !item.reviewedAt).map(({ id, investmentId, type, effectiveDate }) => ({ id, investmentId, type, effectiveDate })),
      snapshots: latestSnapshot ? [] : [{ reason: "missing_snapshot" }]
    };
  }

  portfolioAnalytics(asOf: string, source?: string): PortfolioAnalytics {
    const portfolio = this.getPortfolio();
    if (asOf < portfolio.reliableFrom) {
      throw validation("Requested date is before reliable portfolio history", { reliableFrom: portfolio.reliableFrom });
    }
    const ending = this.valuedPortfolio(asOf, source);
    const endingValue = sumAvailableValues(ending);
    const diagnostics: AnalyticsDiagnostic[] = ending
      .filter((item) => item.valuationStatus === "unavailable")
      .map((item) => ({ ...item.missing, severity: "required" } as AnalyticsDiagnostic));

    const opening = this.valueOpeningPositions(portfolio.reliableFrom, source);
    diagnostics.push(...opening.diagnostics);

    let contributions = 0;
    let withdrawals = 0;
    const flowProvenance: ExternalFlowValue[] = [];
    for (const operation of this.listOperations().filter((item) =>
      (item.type === "contribution" || item.type === "withdrawal") &&
      item.effectiveDate >= portfolio.reliableFrom && item.effectiveDate <= asOf)) {
      const valued = this.valueExternalFlow(operation, source);
      flowProvenance.push(valued);
      if (valued.baseValue === undefined) diagnostics.push(...valued.diagnostics);
      else if (operation.type === "contribution") contributions += valued.baseValue;
      else withdrawals += valued.baseValue;
    }

    diagnostics.push(...this.relevantAdvisoryDiagnostics(asOf));

    const netExternalFlow = clean(contributions - withdrawals);
    const gainLoss = endingValue !== undefined && opening.baseValue !== undefined &&
      flowProvenance.every((item) => item.baseValue !== undefined)
      ? clean(endingValue - opening.baseValue - netExternalFlow)
      : undefined;
    return {
      portfolioId: portfolio.id,
      date: asOf,
      reliableFrom: portfolio.reliableFrom,
      baseCurrency: portfolio.baseCurrency,
      marketValue: endingValue,
      openingValue: opening.baseValue,
      contributions: clean(contributions),
      withdrawals: clean(withdrawals),
      netExternalFlow,
      gainLoss,
      formula: "gainLoss = marketValue - openingValue - netExternalFlow",
      flowProvenance,
      completeness: completeness(diagnostics, [endingValue, opening.baseValue, gainLoss])
    };
  }

  concentration(asOf: string, top: number, source?: string): Concentration {
    if (!Number.isInteger(top) || top < 1 || top > 100) throw validation("top must be an integer between 1 and 100");
    const positions = this.valuedPortfolio(asOf, source);
    const diagnostics: AnalyticsDiagnostic[] = positions.filter((item) => item.valuationStatus === "unavailable")
      .map((item) => ({ ...item.missing, severity: "required" } as AnalyticsDiagnostic));
    diagnostics.push(...this.relevantAdvisoryDiagnostics(asOf));
    const byAsset = new Map<string, { investment: Investment; baseValue: number }>();
    for (const position of positions.filter((item) => item.valuationStatus === "available")) {
      const current = byAsset.get(position.investment.id) ?? { investment: position.investment, baseValue: 0 };
      current.baseValue = clean(current.baseValue + (position.baseValue ?? 0));
      byAsset.set(position.investment.id, current);
    }
    const total = [...byAsset.values()].reduce((sum, item) => sum + item.baseValue, 0);
    const complete = diagnostics.length === 0;
    const assets = [...byAsset.values()].sort((a, b) =>
      b.baseValue - a.baseValue || a.investment.market.localeCompare(b.investment.market) ||
      a.investment.symbol.localeCompare(b.investment.symbol) || a.investment.id.localeCompare(b.investment.id));
    const largest = assets.slice(0, top).map((item) => ({
      investment: item.investment,
      baseValue: item.baseValue,
      weight: complete && total > 0 ? clean(item.baseValue / total) : undefined
    }));
    const topWeight = complete && total > 0 ? clean(largest.reduce((sum, item) => sum + (item.weight ?? 0), 0)) : undefined;
    return {
      date: asOf, baseCurrency: this.getPortfolio().baseCurrency, requestedTop: top,
      totalMarketValue: total, assets: largest, topWeight,
      remainingWeight: topWeight === undefined ? undefined : clean(1 - topWeight),
      completeness: completeness(diagnostics, [complete ? total : undefined])
    };
  }

  portfolioEvolution(input: EvolutionInput): PortfolioEvolution {
    const portfolio = this.getPortfolio();
    if (input.from > input.to) throw validation("from must be on or before to");
    if (input.from < portfolio.reliableFrom) throw validation("from is before reliable portfolio history", { reliableFrom: portfolio.reliableFrom });
    if (daysBetween(input.from, input.to) > 3653) throw validation("Requested evolution exceeds the 10 year range limit");
    const dates = sampleDates(input.from, input.to, input.interval);
    if (dates.length > 366) throw validation("Requested evolution exceeds the 366 sample limit", { sampleCount: dates.length });
    const samples = dates.map((date) => ({ date, analytics: this.portfolioAnalytics(date, input.source) })) as EvolutionSample[];
    let benchmark: Benchmark | undefined;
    if (input.benchmarkId) benchmark = this.get(this.benchmarks, "benchmark", input.benchmarkId);
    for (const [index, sample] of samples.entries()) {
      if (!benchmark) continue;
      const observation = this.selectBenchmarkObservation(
        benchmark.id, sample.date, input.source, index === 0 ? undefined : samples[index - 1].date
      );
      if (observation) sample.benchmark = { value: observation.value, observation };
      else sample.benchmark = {
        diagnostic: { type: "benchmark", severity: "required", benchmarkId: benchmark.id, date: sample.date, source: input.source }
      };
    }
    const baseline = samples.find((sample) => sample.analytics.marketValue !== undefined && (!benchmark || sample.benchmark?.value !== undefined));
    if (baseline?.analytics.marketValue !== undefined && baseline.analytics.marketValue > 0) {
      const portfolioBase = baseline.analytics.marketValue;
      const benchmarkBase = baseline.benchmark?.value;
      for (const sample of samples) {
        if (sample.analytics.marketValue !== undefined) sample.portfolioIndex = clean(sample.analytics.marketValue / portfolioBase * 100);
        if (benchmarkBase !== undefined && sample.benchmark?.value !== undefined) {
          sample.benchmarkIndex = clean(sample.benchmark.value / benchmarkBase * 100);
        }
      }
    }
    return {
      portfolioId: portfolio.id, from: input.from, to: input.to, interval: input.interval,
      baseCurrency: portfolio.baseCurrency, benchmark, normalizationDate: baseline?.date, samples
    };
  }

  private valueOpeningPositions(date: string, source?: string): { baseValue?: number; diagnostics: AnalyticsDiagnostic[] } {
    const portfolio = this.getPortfolio();
    let baseValue = 0;
    const diagnostics: AnalyticsDiagnostic[] = [];
    for (const opening of this.listOpeningPositions(portfolio.id)) {
      const price = this.selectPrice(opening.investmentId, date, source);
      if (!price) {
        diagnostics.push({ type: "price", severity: "required", investmentId: opening.investmentId, date, source });
        continue;
      }
      const originalValue = opening.quantity * price.value;
      if (price.currency === portfolio.baseCurrency) {
        baseValue += originalValue;
        continue;
      }
      const fx = this.selectFx(price.currency, portfolio.baseCurrency, date, source);
      if (!fx) {
        diagnostics.push({
          type: "fx", severity: "required", baseCurrency: price.currency,
          quoteCurrency: portfolio.baseCurrency, investmentId: opening.investmentId, date, source
        });
        continue;
      }
      baseValue += originalValue * fx.rate;
    }
    return { baseValue: diagnostics.length === 0 ? clean(baseValue) : undefined, diagnostics };
  }

  private valueExternalFlow(operation: Operation, source?: string): ExternalFlowValue {
    const portfolio = this.getPortfolio();
    const diagnostics: AnalyticsDiagnostic[] = [];
    let unitValue = operation.price;
    let currency = operation.currency;
    let priceObservation: PriceObservation | undefined;
    if (unitValue === undefined) {
      priceObservation = this.selectPrice(operation.investmentId, operation.effectiveDate, source);
      if (!priceObservation) {
        diagnostics.push({
          type: "price", severity: "required", investmentId: operation.investmentId,
          operationId: operation.id, date: operation.effectiveDate, source
        });
        return { operationId: operation.id, type: operation.type as "contribution" | "withdrawal", date: operation.effectiveDate, diagnostics };
      }
      unitValue = priceObservation.value;
      currency = priceObservation.currency;
    }
    const originalValue = clean(operation.quantity * unitValue);
    if (currency === portfolio.baseCurrency) {
      return {
        operationId: operation.id, type: operation.type as "contribution" | "withdrawal",
        date: operation.effectiveDate, originalValue, originalCurrency: currency,
        baseValue: originalValue, priceObservationId: priceObservation?.id, diagnostics
      };
    }
    const fx = this.selectFx(currency, portfolio.baseCurrency, operation.effectiveDate, source);
    if (!fx) {
      diagnostics.push({
        type: "fx", severity: "required", baseCurrency: currency, quoteCurrency: portfolio.baseCurrency,
        operationId: operation.id, date: operation.effectiveDate, source
      });
      return {
        operationId: operation.id, type: operation.type as "contribution" | "withdrawal",
        date: operation.effectiveDate, originalValue, originalCurrency: currency,
        priceObservationId: priceObservation?.id, diagnostics
      };
    }
    return {
      operationId: operation.id, type: operation.type as "contribution" | "withdrawal",
      date: operation.effectiveDate, originalValue, originalCurrency: currency,
      baseValue: clean(originalValue * fx.rate), priceObservationId: priceObservation?.id,
      fxObservationId: fx.observation.id, fxInverted: fx.inverted, diagnostics
    };
  }

  private selectBenchmarkObservation(benchmarkId: string, date: string, source?: string, afterDate?: string): BenchmarkObservation | undefined {
    const lowerBound = afterDate ?? date;
    return [...this.benchmarkObservations.values()]
      .filter((item) => {
        const effectiveDate = item.effectiveAt.slice(0, 10);
        return item.benchmarkId === benchmarkId && effectiveDate <= date &&
          (afterDate ? effectiveDate > lowerBound : effectiveDate === lowerBound) &&
          (!source || item.source === source);
      })
      .sort((a, b) => b.effectiveAt.localeCompare(a.effectiveAt) || a.source.localeCompare(b.source) || a.id.localeCompare(b.id))[0];
  }

  private relevantAdvisoryDiagnostics(asOf: string): AnalyticsDiagnostic[] {
    const pendingOperations: AnalyticsDiagnostic[] = this.listOperations()
      .filter((item) => item.effectiveDate <= asOf && !item.reviewedAt)
      .map((item) => ({
        type: "pending_operation", severity: "advisory", operationId: item.id,
        investmentId: item.investmentId, date: item.effectiveDate
      }));
    const unresolvedStatements: AnalyticsDiagnostic[] = this.listStatements()
      .filter((statement) => statement.statementDate <= asOf)
      .flatMap((statement) => statement.lines.filter((line) => !line.resolved).map((line) => ({
        type: "unresolved_statement_asset", severity: "advisory" as const,
        statementId: statement.id, statementLineId: line.id, date: statement.statementDate,
        market: line.market, symbol: line.symbol
      })));
    return [...pendingOperations, ...unresolvedStatements];
  }

  private positionStates(asOf: string): PositionState[] {
    const states = new Map<string, PositionState>();
    const getState = (accountId: string, investmentId: string) => {
      const key = `${accountId}:${investmentId}`;
      let state = states.get(key);
      if (!state) {
        state = { accountId, investmentId, quantity: 0, knownCost: 0, unknownCostQuantity: 0 };
        states.set(key, state);
      }
      return state;
    };
    for (const opening of this.openingPositions.values()) {
      if (opening.effectiveDate > asOf) continue;
      const state = getState(opening.accountId, opening.investmentId);
      state.quantity += opening.quantity;
      if (opening.totalCost === undefined) state.unknownCostQuantity += opening.quantity;
      else state.knownCost += opening.totalCost;
    }
    for (const operation of this.listOperations()) {
      if (operation.effectiveDate > asOf) continue;
      const state = getState(operation.accountId, operation.investmentId);
      switch (operation.type) {
        case "buy":
        case "contribution":
          state.quantity += operation.quantity;
          if (operation.price === undefined) state.unknownCostQuantity += operation.quantity;
          else state.knownCost += operation.quantity * operation.price + (operation.fees ?? 0);
          break;
        case "sell":
        case "withdrawal":
        case "redemption":
        case "maturity":
          removeQuantity(state, operation.quantity);
          break;
        case "transfer": {
          const moved = removeQuantity(state, operation.quantity);
          const destination = getState(operation.destinationAccountId!, operation.investmentId);
          destination.quantity += moved.quantity;
          destination.knownCost += moved.knownCost;
          destination.unknownCostQuantity += moved.unknownCostQuantity;
          break;
        }
        case "split":
        case "reverse_split": {
          const ratio = operation.ratio!;
          state.quantity = state.quantity * ratio - (operation.fractionalQuantity ?? 0);
          state.unknownCostQuantity = state.quantity === 0 ? 0 : state.unknownCostQuantity * ratio;
          break;
        }
        case "bonus":
          state.quantity += operation.quantity;
          state.knownCost += operation.bonusTotalCost ?? 0;
          break;
        case "dividend":
        case "yield":
          break;
      }
    }
    for (const state of states.values()) {
      state.quantity = clean(state.quantity);
      state.knownCost = clean(state.knownCost);
      state.unknownCostQuantity = clean(state.unknownCostQuantity);
      if (state.quantity < -1e-8) throw validation("Operation sequence produces a negative position", { accountId: state.accountId, investmentId: state.investmentId, quantity: state.quantity });
    }
    return [...states.values()];
  }
  private assertCalculatedState(asOf: string): void { this.positionStates(asOf); }

  private selectPrice(investmentId: string, date: string, source?: string): PriceObservation | undefined {
    return [...this.prices.values()].filter((item) => item.investmentId === investmentId && item.effectiveAt.slice(0, 10) <= date && (!source || item.source === source))
      .sort((a, b) => b.effectiveAt.localeCompare(a.effectiveAt) || a.source.localeCompare(b.source) || a.id.localeCompare(b.id))[0];
  }
  private selectFx(from: string, to: string, date: string, source?: string): { rate: number; observation: FxRate; inverted: boolean } | undefined {
    const candidates = [...this.fxRates.values()].filter((item) => item.effectiveAt.slice(0, 10) <= date && (!source || item.source === source) &&
      ((item.baseCurrency === from && item.quoteCurrency === to) || (item.baseCurrency === to && item.quoteCurrency === from)))
      .sort((a, b) => b.effectiveAt.localeCompare(a.effectiveAt) || a.source.localeCompare(b.source) || a.id.localeCompare(b.id));
    const observation = candidates[0];
    if (!observation) return undefined;
    const inverted = observation.baseCurrency === to;
    return { rate: inverted ? 1 / observation.rate : observation.rate, observation, inverted };
  }

  private insert<T extends { id: string; createdAt: string; updatedAt: string }>(map: Map<string, T>, prefix: string, input: Omit<T, "id" | "createdAt" | "updatedAt">): T {
    const timestamp = nowIso();
    const record = { ...input, id: newId(prefix), createdAt: timestamp, updatedAt: timestamp } as T;
    map.set(record.id, record);
    return record;
  }
  private update<T extends { id: string; updatedAt: string }>(map: Map<string, T>, label: string, id: string, patch: Patch<T>): T {
    const current = this.get(map, label, id);
    const updated = { ...current, ...patch, id: current.id, updatedAt: nowIso() };
    map.set(id, updated);
    return updated;
  }
  get<T>(map: Map<string, T>, label: string, id: string): T {
    const record = map.get(id);
    if (!record) throw notFound(label, id);
    return record;
  }
  requireInvestment(id: string): Investment { return this.get(this.investments, "investment", id); }
}

function removeQuantity(state: PositionState, quantity: number): { quantity: number; knownCost: number; unknownCostQuantity: number } {
  if (quantity > state.quantity + 1e-8) throw validation("Insufficient position quantity", { accountId: state.accountId, investmentId: state.investmentId, available: state.quantity, requested: quantity });
  const proportion = state.quantity === 0 ? 0 : quantity / state.quantity;
  const knownCost = state.knownCost * proportion;
  const unknownCostQuantity = state.unknownCostQuantity * proportion;
  state.quantity -= quantity;
  state.knownCost -= knownCost;
  state.unknownCostQuantity -= unknownCostQuantity;
  return { quantity, knownCost, unknownCostQuantity };
}
function hashOperation(input: Record<string, unknown>): string {
  return createHash("sha256").update(canonicalOperationPayload(input)).digest("hex");
}
function clean(value: number): number { return Math.abs(value) < 1e-10 ? 0 : Number(value.toFixed(8)); }
function nearZero(value: number): boolean { return Math.abs(value) < 1e-8; }

export type PortfolioPosition = {
  investment: Investment;
  accountId: string;
  quantity: number;
  totalCost?: number;
  costStatus: "known" | "partial" | "unknown";
  unknownCostQuantity: number;
  reliableFrom: string;
  reliable: boolean;
};
export type ValuedPosition = PortfolioPosition & {
  baseCurrency: string;
  valuationStatus: "available" | "unavailable";
  originalValue?: number;
  baseValue?: number;
  originalGainLoss?: number;
  price?: PriceObservation;
  fx?: FxRate;
  fxInverted?: boolean;
  missing?: Record<string, unknown>;
  completeness: Completeness;
};
export type ValuedAllocation = {
  key: string;
  baseCurrency: string;
  baseValue: number;
  weight?: number;
  completeness: Completeness;
  unavailablePositions: Array<{ investmentId: string; missing?: Record<string, unknown> }>;
};
export type Allocation = { key: string; quantity: number };
export type DailyPackage = { date: string; currentPortfolio: PortfolioPosition[]; news: NewsItem[]; recentOperations: Operation[]; pending: PendingWork };
export type PendingWork = {
  news: Array<Pick<NewsItem, "id" | "title" | "publishedAt">>;
  operations: Array<Pick<Operation, "id" | "investmentId" | "type" | "effectiveDate">>;
  snapshots: Array<{ reason: string }>;
};
export type VirtualComparison = { investment: Investment; realQuantity: number; virtualQuantity: number; quantityDifference: number };
export type AnalyticsDiagnostic = {
  type: string;
  severity: "required" | "advisory";
  date?: string;
  source?: string;
  investmentId?: string;
  operationId?: string;
  benchmarkId?: string;
  baseCurrency?: string;
  quoteCurrency?: string;
  [key: string]: unknown;
};
export type Completeness = {
  status: "complete" | "partial" | "unavailable";
  diagnostics: AnalyticsDiagnostic[];
};
export type ExternalFlowValue = {
  operationId: string;
  type: "contribution" | "withdrawal";
  date: string;
  originalValue?: number;
  originalCurrency?: string;
  baseValue?: number;
  priceObservationId?: string;
  fxObservationId?: string;
  fxInverted?: boolean;
  diagnostics: AnalyticsDiagnostic[];
};
export type PortfolioAnalytics = {
  portfolioId: string;
  date: string;
  reliableFrom: string;
  baseCurrency: string;
  marketValue?: number;
  openingValue?: number;
  contributions: number;
  withdrawals: number;
  netExternalFlow: number;
  gainLoss?: number;
  formula: string;
  flowProvenance: ExternalFlowValue[];
  completeness: Completeness;
};
export type Concentration = {
  date: string;
  baseCurrency: string;
  requestedTop: number;
  totalMarketValue: number;
  assets: Array<{ investment: Investment; baseValue: number; weight?: number }>;
  topWeight?: number;
  remainingWeight?: number;
  completeness: Completeness;
};
export type EvolutionInterval = "daily" | "weekly" | "monthly";
export type EvolutionInput = {
  from: string;
  to: string;
  interval: EvolutionInterval;
  source?: string;
  benchmarkId?: string;
};
export type EvolutionSample = {
  date: string;
  analytics: PortfolioAnalytics;
  portfolioIndex?: number;
  benchmark?: { value?: number; observation?: BenchmarkObservation; diagnostic?: AnalyticsDiagnostic };
  benchmarkIndex?: number;
};
export type PortfolioEvolution = {
  portfolioId: string;
  from: string;
  to: string;
  interval: EvolutionInterval;
  baseCurrency: string;
  benchmark?: Benchmark;
  normalizationDate?: string;
  samples: EvolutionSample[];
};

function sumAvailableValues(positions: ValuedPosition[]): number | undefined {
  if (positions.some((item) => item.valuationStatus === "unavailable")) return undefined;
  return clean(positions.reduce((sum, item) => sum + (item.baseValue ?? 0), 0));
}

function completeness(diagnostics: AnalyticsDiagnostic[], requiredValues: Array<number | undefined>): Completeness {
  const requiredMissing = diagnostics.some((item) => item.severity === "required") || requiredValues.some((item) => item === undefined);
  if (requiredMissing && requiredValues.every((item) => item === undefined)) return { status: "unavailable", diagnostics };
  if (requiredMissing || diagnostics.length > 0) return { status: "partial", diagnostics };
  return { status: "complete", diagnostics };
}

function daysBetween(from: string, to: string): number {
  return Math.floor((Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / 86_400_000);
}

function sampleDates(from: string, to: string, interval: EvolutionInterval): string[] {
  const dates = new Set<string>([from, to]);
  let current = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  if (interval === "daily") {
    while (current <= end) {
      dates.add(current.toISOString().slice(0, 10));
      current.setUTCDate(current.getUTCDate() + 1);
    }
  } else if (interval === "weekly") {
    current.setUTCDate(current.getUTCDate() + (7 - current.getUTCDay()) % 7);
    while (current <= end) {
      dates.add(current.toISOString().slice(0, 10));
      current.setUTCDate(current.getUTCDate() + 7);
    }
  } else {
    current = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 0));
    while (current <= end) {
      dates.add(current.toISOString().slice(0, 10));
      current = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 2, 0));
    }
  }
  return [...dates].filter((date) => date >= from && date <= to).sort();
}
