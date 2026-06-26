import { z } from "zod";
import { createHash } from "node:crypto";

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
  sourceId?: string;
  externalId?: string;
  url?: string;
  canonicalUrl?: string;
  title: string;
  summary?: string;
  body?: string;
  publishedAt: string;
  retrievedAt?: string;
  language?: string;
  region?: string;
  topicTags: string[];
  rawHash?: string;
  duplicateGroup?: string;
  relatedInvestmentIds: string[];
  processedAt?: string;
  processedBy?: string;
  processingNotes?: string;
  createdAt: string;
  updatedAt: string;
};

export const newsAdapterTypes = ["rss", "guardian", "alpha_vantage", "gdelt", "commercial"] as const;
export const editorialTypes = ["news", "official_analysis", "research", "opinion", "advocacy", "aggregator"] as const;
export const newsSourcePriorities = ["core", "supporting", "optional", "fallback", "paid_core"] as const;
export type NewsAdapterType = (typeof newsAdapterTypes)[number];
export type EditorialType = (typeof editorialTypes)[number];
export type NewsSourcePriority = (typeof newsSourcePriorities)[number];

export type NewsSourceConfig = {
  fetchArticleContent?: boolean;
  dateField?: "pubDate" | "dc:date" | "updated" | "published";
  futureToleranceMinutes?: number;
  allowFutureEvents?: boolean;
  query?: string;
  section?: string;
  pageSize?: number;
  candidateFilters?: {
    whitelist?: NewsSourceCandidateFilterRule[];
    blacklist?: NewsSourceCandidateFilterRule[];
  };
};

export type NewsSourceCandidateFilterRule = {
  value: string;
  mode: "contains" | "word" | "exact" | "regex";
  target: "title" | "category" | "both";
  enabled?: boolean;
  reason?: string;
};

export type NewsSource = {
  id: string;
  slug: string;
  name: string;
  adapterType: NewsAdapterType;
  endpoint: string;
  enabled: boolean;
  priority: NewsSourcePriority;
  editorialType: EditorialType;
  language?: string;
  region?: string;
  accessTier: string;
  pollingIntervalMinutes: number;
  staleAfterMinutes: number;
  overlapMinutes: number;
  requestTimeoutMs: number;
  maxResponseBytes: number;
  maxConcurrency: number;
  secretRef?: string;
  config: NewsSourceConfig;
  disabledReason?: string;
  createdAt: string;
  updatedAt: string;
};

export type NewsSourceState = {
  sourceId: string;
  watermark?: string;
  etag?: string;
  lastModified?: string;
  latestItemAt?: string;
  lastAttemptAt?: string;
  lastSuccessAt?: string;
  consecutiveFailures: number;
  nextPollAt?: string;
  leaseOwner?: string;
  leaseExpiresAt?: string;
  lastErrorCode?: string;
  updatedAt: string;
};

export type NewsCollectionRunStatus = "running" | "success" | "no_change" | "partial" | "failed" | "rate_limited" | "skipped";
export type NewsCollectionTrigger = "scheduled" | "manual" | "cli";
export type NewsCollectionCounts = {
  fetched: number;
  accepted: number;
  created: number;
  enriched: number;
  duplicates: number;
  rejected: number;
  articleFailures: number;
};
export type NewsCollectionRun = {
  id: string;
  sourceId: string;
  trigger: NewsCollectionTrigger;
  windowFrom: string;
  windowTo: string;
  status: NewsCollectionRunStatus;
  startedAt: string;
  completedAt?: string;
  counts: NewsCollectionCounts;
  diagnostics: string[];
  errorCode?: string;
  createdAt: string;
  updatedAt: string;
};

export type NewsSourceHealth = {
  status: "healthy" | "stale" | "failing" | "never_collected" | "disabled";
  latestItemAt?: string;
  lastSuccessAt?: string;
  consecutiveFailures: number;
};

export const classificationImportances = ["low", "medium", "high", "critical"] as const;
export const classificationScopes = ["global", "country", "sector", "company", "mixed"] as const;
export const classificationHorizons = ["immediate", "short_term", "medium_term", "long_term"] as const;
export const impactDirections = ["positive", "negative", "mixed", "neutral", "uncertain"] as const;
export const impactMagnitudes = ["low", "medium", "high", "unknown"] as const;
export const classificationReviewDecisions = ["approved", "rejected", "needs_revision"] as const;
export type ClassificationImportance = (typeof classificationImportances)[number];
export type ClassificationScope = (typeof classificationScopes)[number];
export type ClassificationHorizon = (typeof classificationHorizons)[number];
export type ImpactDirection = (typeof impactDirections)[number];
export type ImpactMagnitude = (typeof impactMagnitudes)[number];
export type ClassificationReviewDecision = (typeof classificationReviewDecisions)[number];

export type ClassificationSector = { taxonomy: string; code: string; label?: string };
export type ClassificationEvidence = {
  id: string;
  key: string;
  sourceField: "title" | "summary" | "body";
  excerpt?: string;
  explanation: string;
};
export type ClassificationTarget = {
  id: string;
  classificationId: string;
  targetType: "country" | "currency" | "sector" | "company" | "investment";
  targetKey: string;
  investmentId?: string;
  companyName?: string;
  market?: string;
  symbol?: string;
  direction: ImpactDirection;
  magnitude: ImpactMagnitude;
  confidence: number;
  rationale: string;
  evidenceKeys: string[];
};
export type NewsClassification = {
  id: string;
  newsId: string;
  classifierId: string;
  classifierType: "agent" | "rule" | "human";
  classifierVersion: string;
  externalRunId: string;
  payloadHash: string;
  importance: ClassificationImportance;
  scope: ClassificationScope;
  horizon: ClassificationHorizon;
  overallConfidence: number;
  tags: string[];
  countries: string[];
  currencies: string[];
  sectors: ClassificationSector[];
  evidence: ClassificationEvidence[];
  targets: ClassificationTarget[];
  supersedesClassificationId?: string;
  createdAt: string;
  updatedAt: string;
};
export type ClassificationReview = {
  id: string;
  classificationId: string;
  reviewer: string;
  decision: ClassificationReviewDecision;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};
export type ClassificationTargetResolution = {
  id: string;
  targetId: string;
  investmentId: string;
  actor: string;
  reason: string;
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
  sourceId: optionalString, externalId: optionalString, canonicalUrl: z.string().url().optional(),
  retrievedAt: timestamp.optional(), language: optionalString, region: optionalString,
  topicTags: z.array(z.string().trim().min(1)).default([]), rawHash: optionalString, duplicateGroup: optionalString,
  relatedInvestmentIds: z.array(z.string().trim().min(1)).default([])
});
export const newsPatchSchema = newsCreateSchema.partial();
const tagSlug = z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/).max(64);
const classificationEvidenceInputSchema = z.object({
  key: tagSlug,
  sourceField: z.enum(["title", "summary", "body"]),
  excerpt: z.string().trim().min(1).max(1000).optional(),
  explanation: z.string().trim().min(1).max(2000)
}).strict();
const classificationTargetInputSchema = z.object({
  targetType: z.enum(["country", "currency", "sector", "company", "investment"]),
  targetKey: z.string().trim().min(1).max(160).optional(),
  investmentId: optionalString,
  companyName: z.string().trim().min(1).max(200).optional(),
  market: z.string().trim().min(1).max(32).transform((value) => value.toUpperCase()).optional(),
  symbol: z.string().trim().min(1).max(32).transform((value) => value.toUpperCase()).optional(),
  direction: z.enum(impactDirections),
  magnitude: z.enum(impactMagnitudes),
  confidence: z.number().finite().min(0).max(1),
  rationale: z.string().trim().min(1).max(3000),
  evidenceKeys: z.array(tagSlug).max(20).default([])
}).strict().superRefine((input, context) => {
  if (input.targetType === "investment" && !input.investmentId) context.addIssue({ code: "custom", path: ["investmentId"], message: "Investment target requires investmentId" });
  if (input.targetType === "company" && !input.companyName) context.addIssue({ code: "custom", path: ["companyName"], message: "Company target requires companyName" });
  if (!["investment", "company"].includes(input.targetType) && !input.targetKey) context.addIssue({ code: "custom", path: ["targetKey"], message: "Target type requires targetKey" });
});
export const newsClassificationCreateSchema = z.object({
  classifierId: tagSlug,
  classifierType: z.enum(["agent", "rule", "human"]),
  classifierVersion: z.string().trim().min(1).max(120),
  externalRunId: z.string().trim().min(1).max(200),
  importance: z.enum(classificationImportances),
  scope: z.enum(classificationScopes),
  horizon: z.enum(classificationHorizons),
  overallConfidence: z.number().finite().min(0).max(1),
  tags: z.array(tagSlug).max(50).default([]),
  countries: z.array(z.string().trim().regex(/^[A-Za-z]{2}$/).transform((value) => value.toUpperCase())).max(50).default([]),
  currencies: z.array(z.string().trim().regex(/^[A-Za-z]{3}$/).transform((value) => value.toUpperCase())).max(50).default([]),
  sectors: z.array(z.object({
    taxonomy: tagSlug,
    code: tagSlug,
    label: z.string().trim().min(1).max(160).optional()
  }).strict()).max(50).default([]),
  evidence: z.array(classificationEvidenceInputSchema).max(30).default([]),
  targets: z.array(classificationTargetInputSchema).max(100).default([]),
  supersedesClassificationId: optionalString
}).strict().superRefine((input, context) => {
  for (const [field, values] of [["tags", input.tags], ["countries", input.countries], ["currencies", input.currencies]] as const) {
    if (new Set(values).size !== values.length) context.addIssue({ code: "custom", path: [field], message: `Duplicate ${field} values` });
  }
  const evidence = new Set(input.evidence.map((item) => item.key));
  if (evidence.size !== input.evidence.length) context.addIssue({ code: "custom", path: ["evidence"], message: "Duplicate evidence keys" });
  const sectors = input.sectors.map((sector) => `${sector.taxonomy}:${sector.code}`);
  if (new Set(sectors).size !== sectors.length) context.addIssue({ code: "custom", path: ["sectors"], message: "Duplicate sector identity" });
  const targets = input.targets.map((target) => classificationTargetIdentity(target));
  if (new Set(targets).size !== targets.length) context.addIssue({ code: "custom", path: ["targets"], message: "Duplicate target identity" });
  input.targets.forEach((target, index) => target.evidenceKeys.forEach((key) => {
    if (!evidence.has(key)) context.addIssue({ code: "custom", path: ["targets", index, "evidenceKeys"], message: `Unknown evidence key: ${key}` });
  }));
});
export const classificationReviewCreateSchema = z.object({
  reviewer: z.string().trim().min(1).max(120),
  decision: z.enum(classificationReviewDecisions),
  notes: z.string().trim().min(1).max(3000).optional()
}).strict();
export const classificationResolutionCreateSchema = z.object({
  investmentId: z.string().trim().min(1),
  actor: z.string().trim().min(1).max(120),
  reason: z.string().trim().min(1).max(2000)
}).strict();
export type NewsClassificationCreateInput = z.infer<typeof newsClassificationCreateSchema>;
export type ClassificationReviewCreateInput = z.infer<typeof classificationReviewCreateSchema>;
export type ClassificationResolutionCreateInput = z.infer<typeof classificationResolutionCreateSchema>;
const candidateFilterRuleSchema = z.object({
  value: z.string().trim().min(1).max(500),
  mode: z.enum(["contains", "word", "exact", "regex"]).default("contains"),
  target: z.enum(["title", "category", "both"]).default("both"),
  enabled: z.boolean().optional(),
  reason: z.string().trim().min(1).max(500).optional()
}).strict().superRefine((input, context) => {
  if (input.mode !== "regex") return;
  try {
    new RegExp(input.value, "iu");
  } catch {
    context.addIssue({ code: "custom", path: ["value"], message: "Invalid candidate filter regex" });
  }
});
const newsSourceConfigSchema = z.object({
  fetchArticleContent: z.boolean().optional(),
  dateField: z.enum(["pubDate", "dc:date", "updated", "published"]).optional(),
  futureToleranceMinutes: z.number().int().min(0).max(1440).optional(),
  allowFutureEvents: z.boolean().optional(),
  query: z.string().trim().min(1).optional(),
  section: z.string().trim().min(1).optional(),
  pageSize: z.number().int().min(1).max(200).optional(),
  candidateFilters: z.object({
    whitelist: z.array(candidateFilterRuleSchema).max(200).optional(),
    blacklist: z.array(candidateFilterRuleSchema).max(200).optional()
  }).strict().optional()
}).strict();
const newsSourceBaseSchema = z.object({
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().trim().min(1),
  adapterType: z.enum(newsAdapterTypes),
  endpoint: z.string().url().refine((value) => ["http:", "https:"].includes(new URL(value).protocol), "HTTP(S) endpoint required"),
  enabled: z.boolean().default(false),
  priority: z.enum(newsSourcePriorities).default("optional"),
  editorialType: z.enum(editorialTypes).default("news"),
  language: optionalString,
  region: optionalString,
  accessTier: z.string().trim().min(1).default("free"),
  pollingIntervalMinutes: z.number().int().min(5).max(1440).default(15),
  staleAfterMinutes: z.number().int().min(5).max(43200).default(1440),
  overlapMinutes: z.number().int().min(0).max(1440).default(120),
  requestTimeoutMs: z.number().int().min(1000).max(120000).default(15000),
  maxResponseBytes: z.number().int().min(1024).max(20_000_000).default(3_000_000),
  maxConcurrency: z.number().int().min(1).max(10).default(2),
  secretRef: z.string().trim().regex(/^[A-Z][A-Z0-9_]*$/).optional(),
  config: newsSourceConfigSchema.default({}),
  disabledReason: optionalString
});
export const newsSourceCreateSchema = newsSourceBaseSchema.superRefine((input, context) => {
  if (input.adapterType === "guardian" && !input.secretRef) {
    context.addIssue({ code: "custom", path: ["secretRef"], message: "Guardian source requires a secret reference" });
  }
});
export const newsSourcePatchSchema = newsSourceBaseSchema.partial();
export const newsCollectionTriggerSchema = z.object({
  sourceIds: z.array(z.string().trim().min(1)).max(50).optional(),
  mode: z.enum(["due", "all_enabled", "selected"]).default("due"),
  trigger: z.enum(["scheduled", "manual", "cli"]).default("manual"),
  from: timestamp.optional(),
  to: timestamp.optional(),
  concurrency: z.number().int().min(1).max(10).default(3)
}).superRefine((input, context) => {
  if (input.mode === "selected" && !input.sourceIds?.length) {
    context.addIssue({ code: "custom", path: ["sourceIds"], message: "Selected mode requires sourceIds" });
  }
  if (input.from && input.to && Date.parse(input.to) - Date.parse(input.from) > 86_400_000) {
    context.addIssue({ code: "custom", path: ["from"], message: "Collection window cannot exceed 24 hours" });
  }
  if (input.from && input.to && input.from > input.to) {
    context.addIssue({ code: "custom", path: ["from"], message: "from must not be after to" });
  }
});
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

export function classificationTargetIdentity(target: {
  targetType: string; targetKey?: string; investmentId?: string; companyName?: string; market?: string; symbol?: string;
}): string {
  const key = target.targetType === "investment" ? target.investmentId
    : target.targetType === "company" ? `${target.companyName?.trim().toLowerCase()}|${target.market ?? ""}|${target.symbol ?? ""}`
    : target.targetKey?.trim().toUpperCase();
  return `${target.targetType}:${key}`;
}

export function canonicalClassificationPayload(input: Record<string, unknown>): string {
  return stableJson(input);
}
export function classificationPayloadHash(input: Record<string, unknown>): string {
  return createHash("sha256").update(canonicalClassificationPayload(input)).digest("hex");
}
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function nowIso(): string { return new Date().toISOString(); }
export function newId(prefix: string): string { return `${prefix}_${crypto.randomUUID()}`; }
