import { z } from "zod";

export const assetClasses = ["stock", "fii", "etf", "fixed_income", "crypto", "cash", "other"] as const;
export const operationTypes = [
  "buy", "sell", "contribution", "withdrawal", "dividend", "yield", "redemption", "maturity",
  "transfer", "split", "reverse_split", "bonus"
] as const;

export type AssetClass = (typeof assetClasses)[number];
export type OperationType = (typeof operationTypes)[number];

export type Portfolio = {
  id: string;
  name: string;
  baseCurrency: string;
  reliableFrom: string;
  createdAt: string;
  updatedAt: string;
};

export type BrokerageAccount = {
  id: string;
  portfolioId: string;
  name: string;
  institution?: string;
  externalId?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Investment = {
  id: string;
  symbol: string;
  name: string;
  assetClass: AssetClass;
  currency: string;
  market: string;
  isin?: string;
  country?: string;
  broker?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type OpeningPosition = {
  id: string;
  portfolioId: string;
  accountId: string;
  investmentId: string;
  effectiveDate: string;
  quantity: number;
  currency: string;
  totalCost?: number;
  createdAt: string;
  updatedAt: string;
};

export type Operation = {
  id: string;
  investmentId: string;
  accountId: string;
  destinationAccountId?: string;
  type: OperationType;
  effectiveDate: string;
  quantity: number;
  price?: number;
  currency: string;
  fees?: number;
  ratio?: number;
  bonusTotalCost?: number;
  fractionalQuantity?: number;
  notes?: string;
  importSource?: string;
  externalId?: string;
  payloadHash?: string;
  version: number;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNotes?: string;
  createdAt: string;
  updatedAt: string;
};

export type OperationRevision = {
  id: string;
  operationId: string;
  version: number;
  actor: string;
  reason: string;
  before: Operation;
  after: Operation;
  createdAt: string;
  updatedAt: string;
};

export type PriceObservation = {
  id: string;
  investmentId: string;
  effectiveAt: string;
  value: number;
  currency: string;
  source: string;
  createdAt: string;
  updatedAt: string;
};

export type FxRate = {
  id: string;
  baseCurrency: string;
  quoteCurrency: string;
  effectiveAt: string;
  rate: number;
  source: string;
  createdAt: string;
  updatedAt: string;
};

export type StatementLine = {
  id: string;
  investmentId?: string;
  market?: string;
  symbol: string;
  quantity: number;
  currency: string;
  totalCost?: number;
  marketValue?: number;
  resolved: boolean;
};

export type PortfolioStatement = {
  id: string;
  accountId: string;
  statementDate: string;
  source: string;
  externalId?: string;
  lines: StatementLine[];
  createdAt: string;
  updatedAt: string;
};

export type ReconciliationResult = {
  investmentId?: string;
  market: string;
  symbol: string;
  reportedQuantity: number;
  calculatedQuantity: number;
  quantityDifference: number;
  status: "matched" | "discrepancy" | "statement_only" | "ledger_only" | "unresolved";
  reportedCost?: number;
  calculatedCost?: number;
  costDifference?: number;
  costAvailable: boolean;
  costFxObservationId?: string;
  costFxInverted?: boolean;
  reportedMarketValue?: number;
  calculatedMarketValue?: number;
  marketValueDifference?: number;
  marketValueAvailable: boolean;
  valuePriceObservationId?: string;
  valueFxObservationId?: string;
  valueFxInverted?: boolean;
};

export type Reconciliation = {
  id: string;
  statementId: string;
  accountId: string;
  statementDate: string;
  status: "matched" | "discrepancies";
  results: ReconciliationResult[];
  createdAt: string;
  updatedAt: string;
};

export type NewsItem = {
  id: string;
  source: string;
  url?: string;
  title: string;
  summary?: string;
  body?: string;
  publishedAt: string;
  relatedInvestmentIds: string[];
  processedAt?: string;
  processedBy?: string;
  processingNotes?: string;
  createdAt: string;
  updatedAt: string;
};

export type WatchedAsset = {
  id: string;
  symbol: string;
  name: string;
  assetClass: AssetClass;
  currency: string;
  market?: string;
  country?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type VirtualPortfolio = { id: string; name: string; description?: string; createdAt: string; updatedAt: string };
export type VirtualPosition = { id: string; virtualPortfolioId: string; investmentId: string; quantity: number; targetWeight?: number; createdAt: string; updatedAt: string };
export type Benchmark = { id: string; name: string; symbol: string; currency: string; source?: string; createdAt: string; updatedAt: string };
export type BenchmarkObservation = {
  id: string;
  benchmarkId: string;
  effectiveAt: string;
  value: number;
  currency: string;
  source: string;
  createdAt: string;
  updatedAt: string;
};
export type SnapshotPosition = { investmentId: string; quantity: number; currency: string };
export type PortfolioSnapshot = { id: string; capturedAt: string; source?: string; positions: SnapshotPosition[]; createdAt: string; updatedAt: string };

const currency = z.string().trim().length(3).transform((value) => value.toUpperCase());
const optionalString = z.string().trim().min(1).optional();
const date = z.string().date();
const timestamp = z.string().datetime();

export const portfolioPatchSchema = z.object({
  name: z.string().trim().min(1).optional(),
  baseCurrency: currency.optional(),
  reliableFrom: date.optional()
});

export const brokerageAccountCreateSchema = z.object({
  portfolioId: z.string().trim().min(1).default("portfolio_default"),
  name: z.string().trim().min(1),
  institution: optionalString,
  externalId: optionalString
});

export const investmentCreateSchema = z.object({
  symbol: z.string().trim().min(1).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(1),
  assetClass: z.enum(assetClasses),
  currency,
  market: z.string().trim().min(1).transform((value) => value.toUpperCase()),
  isin: optionalString,
  country: optionalString,
  broker: optionalString
});

export const investmentPatchSchema = investmentCreateSchema.partial().extend({ active: z.boolean().optional() });

export const openingPositionCreateSchema = z.object({
  portfolioId: z.string().trim().min(1).default("portfolio_default"),
  accountId: z.string().trim().min(1).default("account_default"),
  investmentId: z.string().trim().min(1),
  effectiveDate: date,
  quantity: z.number().finite().positive(),
  currency,
  totalCost: z.number().finite().nonnegative().optional()
});

export const operationCreateSchema = z.object({
  investmentId: z.string().trim().min(1),
  accountId: z.string().trim().min(1).default("account_default"),
  destinationAccountId: optionalString,
  type: z.enum(operationTypes),
  effectiveDate: date,
  quantity: z.number().finite().nonnegative(),
  price: z.number().finite().nonnegative().optional(),
  currency,
  fees: z.number().finite().nonnegative().optional(),
  ratio: z.number().finite().positive().optional(),
  bonusTotalCost: z.number().finite().nonnegative().optional(),
  fractionalQuantity: z.number().finite().nonnegative().optional(),
  notes: optionalString,
  importSource: optionalString,
  externalId: optionalString
}).superRefine((input, context) => {
  const quantityTypes: OperationType[] = ["buy", "sell", "contribution", "withdrawal", "redemption", "maturity", "transfer", "bonus"];
  if (quantityTypes.includes(input.type) && input.quantity <= 0) {
    context.addIssue({ code: "custom", path: ["quantity"], message: "Quantity must be greater than zero" });
  }
  if (input.type === "transfer" && !input.destinationAccountId) {
    context.addIssue({ code: "custom", path: ["destinationAccountId"], message: "Destination account is required for transfers" });
  }
  if (["split", "reverse_split"].includes(input.type) && !input.ratio) {
    context.addIssue({ code: "custom", path: ["ratio"], message: "Positive ratio is required for splits" });
  }
  if (input.type === "bonus" && input.bonusTotalCost === undefined) {
    context.addIssue({ code: "custom", path: ["bonusTotalCost"], message: "Bonus cost treatment is required, including zero" });
  }
  if ((input.externalId && !input.importSource) || (!input.externalId && input.importSource)) {
    context.addIssue({ code: "custom", path: ["externalId"], message: "importSource and externalId must be provided together" });
  }
});

export const operationRevisionSchema = z.object({
  actor: z.string().trim().min(1),
  reason: z.string().trim().min(1),
  expectedVersion: z.number().int().positive(),
  changes: z.record(z.string(), z.unknown()).refine((value) => Object.keys(value).length > 0, "At least one factual change is required")
});

export const priceObservationCreateSchema = z.object({
  investmentId: z.string().trim().min(1),
  effectiveAt: timestamp,
  value: z.number().finite().nonnegative(),
  currency,
  source: z.string().trim().min(1)
});

export const fxRateCreateSchema = z.object({
  baseCurrency: currency,
  quoteCurrency: currency,
  effectiveAt: timestamp,
  rate: z.number().finite().positive(),
  source: z.string().trim().min(1)
}).refine((input) => input.baseCurrency !== input.quoteCurrency, {
  path: ["quoteCurrency"],
  message: "Base and quote currencies must differ"
});

export const statementCreateSchema = z.object({
  accountId: z.string().trim().min(1),
  statementDate: date,
  source: z.string().trim().min(1),
  externalId: optionalString,
  lines: z.array(z.object({
    investmentId: optionalString,
    market: optionalString.transform((value) => value?.toUpperCase()),
    symbol: z.string().trim().min(1).transform((value) => value.toUpperCase()),
    quantity: z.number().finite().nonnegative(),
    currency,
    totalCost: z.number().finite().nonnegative().optional(),
    marketValue: z.number().finite().nonnegative().optional()
  })).min(1)
});

export const newsCreateSchema = z.object({
  source: z.string().trim().min(1), url: z.string().url().optional(), title: z.string().trim().min(1),
  summary: optionalString, body: optionalString, publishedAt: timestamp,
  relatedInvestmentIds: z.array(z.string().trim().min(1)).default([])
});
export const newsPatchSchema = newsCreateSchema.partial();
export const watchedAssetCreateSchema = z.object({
  symbol: z.string().trim().min(1), name: z.string().trim().min(1), assetClass: z.enum(assetClasses),
  currency, market: optionalString, country: optionalString
});
export const virtualPortfolioCreateSchema = z.object({ name: z.string().trim().min(1), description: optionalString });
export const virtualPositionCreateSchema = z.object({
  investmentId: z.string().trim().min(1), quantity: z.number().finite().nonnegative(),
  targetWeight: z.number().finite().min(0).max(1).optional()
});
export const benchmarkCreateSchema = z.object({ name: z.string().trim().min(1), symbol: z.string().trim().min(1), currency, source: optionalString });
export const benchmarkObservationCreateSchema = z.object({
  benchmarkId: z.string().trim().min(1),
  effectiveAt: timestamp,
  value: z.number().finite().positive(),
  currency,
  source: z.string().trim().min(1)
});
export const snapshotCreateSchema = z.object({
  capturedAt: timestamp, source: optionalString,
  positions: z.array(z.object({ investmentId: z.string().trim().min(1), quantity: z.number().finite().nonnegative(), currency }))
});
export const processingSchema = z.object({ actor: z.string().trim().min(1), notes: optionalString });

export function canonicalOperationPayload(input: Record<string, unknown>): string {
  const factual = Object.fromEntries(Object.entries(input)
    .filter(([key, value]) => value !== undefined && !["payloadHash", "version", "createdAt", "updatedAt", "reviewedAt", "reviewedBy", "reviewNotes"].includes(key))
    .sort(([left], [right]) => left.localeCompare(right)));
  return JSON.stringify(factual);
}

export function nowIso(): string { return new Date().toISOString(); }
export function newId(prefix: string): string { return `${prefix}_${crypto.randomUUID()}`; }
