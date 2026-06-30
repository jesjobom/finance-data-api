import type { OpenAPIV3 } from "openapi-types";

const auth = [{ bearerAuth: [] }];

const errorResponse = {
  description: "Structured error",
  content: {
    "application/json": {
      schema: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: {
              code: { type: "string" },
              message: { type: "string" },
              details: {}
            },
            required: ["code", "message"]
          }
        },
        required: ["error"]
      }
    }
  }
} satisfies OpenAPIV3.ResponseObject;

function ref(schemaName: string): OpenAPIV3.ReferenceObject {
  return { $ref: `#/components/schemas/${schemaName}` };
}

function jsonResponse(
  description: string,
  schema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject
): OpenAPIV3.ResponseObject {
  return {
    description,
    content: {
      "application/json": {
        schema
      }
    }
  };
}

function resourceResponse(description: string, schemaName: string): OpenAPIV3.ResponseObject {
  return jsonResponse(description, ref(schemaName));
}

function collectionResponse(description: string, schemaName: string): OpenAPIV3.ResponseObject {
  return jsonResponse(description, { type: "array", items: ref(schemaName) });
}

function body(schemaRef: string): OpenAPIV3.RequestBodyObject {
  return {
    required: true,
    content: {
      "application/json": {
        schema: { $ref: `#/components/schemas/${schemaRef}` }
      }
    }
  };
}

export const openApiDocument: OpenAPIV3.Document = {
  openapi: "3.1.0",
  info: {
    title: "Finance Data API",
    version: "0.1.0",
    description: "Deterministic finance data API for agent consumption. The API stores facts and processing state, not investment intelligence."
  },
  servers: [{ url: "http://localhost:3000" }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer"
      }
    },
    schemas: {
      InvestmentCreate: {
        type: "object",
        required: ["symbol", "name", "assetClass", "currency", "market"],
        properties: {
          symbol: { type: "string" },
          name: { type: "string" },
          assetClass: { type: "string", enum: ["stock", "fii", "etf", "fixed_income", "crypto", "cash", "other"] },
          currency: { type: "string", minLength: 3, maxLength: 3 },
          market: { type: "string" },
          isin: { type: "string" },
          country: { type: "string" },
          broker: {
            type: "string",
            deprecated: true,
            description: "Legacy compatibility field. Custody belongs to brokerage accounts; new clients should omit this field."
          }
        }
      },
      OperationCreate: {
        type: "object",
        required: ["investmentId", "type", "effectiveDate", "quantity", "currency"],
        properties: {
          investmentId: { type: "string" },
          accountId: { type: "string", default: "account_default" },
          destinationAccountId: { type: "string" },
          type: { type: "string", enum: ["buy", "sell", "contribution", "withdrawal", "dividend", "yield", "redemption", "maturity", "transfer", "split", "reverse_split", "bonus"] },
          effectiveDate: { type: "string", format: "date" },
          quantity: { type: "number", minimum: 0 },
          price: { type: "number", minimum: 0 },
          currency: { type: "string", minLength: 3, maxLength: 3 },
          fees: { type: "number", minimum: 0 },
          ratio: { type: "number", minimum: 0, exclusiveMinimum: true },
          bonusTotalCost: { type: "number", minimum: 0 },
          fractionalQuantity: { type: "number", minimum: 0 },
          importSource: { type: "string" },
          externalId: { type: "string" },
          notes: { type: "string" }
        }
      },
      PortfolioPatch: {
        type: "object",
        properties: {
          name: { type: "string" },
          baseCurrency: { type: "string", minLength: 3, maxLength: 3 },
          reliableFrom: { type: "string", format: "date" }
        }
      },
      BrokerageAccountCreate: {
        type: "object",
        required: ["name"],
        properties: {
          portfolioId: { type: "string", default: "portfolio_default" },
          name: { type: "string" },
          institution: { type: "string" },
          externalId: { type: "string" }
        }
      },
      OpeningPositionCreate: {
        type: "object",
        required: ["investmentId", "effectiveDate", "quantity", "currency"],
        properties: {
          portfolioId: { type: "string", default: "portfolio_default" },
          accountId: { type: "string", default: "account_default" },
          investmentId: { type: "string" },
          effectiveDate: { type: "string", format: "date" },
          quantity: { type: "number", minimum: 0, exclusiveMinimum: true },
          currency: { type: "string", minLength: 3, maxLength: 3 },
          totalCost: { type: "number", minimum: 0, description: "Omit when opening cost basis is unknown." }
        }
      },
      OperationRevision: {
        type: "object",
        required: ["actor", "reason", "expectedVersion", "changes"],
        properties: {
          actor: { type: "string" },
          reason: { type: "string" },
          expectedVersion: { type: "integer", minimum: 1 },
          changes: { type: "object", additionalProperties: true }
        }
      },
      PriceCreate: {
        type: "object",
        required: ["investmentId", "effectiveAt", "value", "currency", "source"],
        properties: {
          investmentId: { type: "string" },
          effectiveAt: { type: "string", format: "date-time" },
          value: { type: "number", minimum: 0 },
          currency: { type: "string", minLength: 3, maxLength: 3 },
          source: { type: "string" }
        }
      },
      FxRateCreate: {
        type: "object",
        required: ["baseCurrency", "quoteCurrency", "effectiveAt", "rate", "source"],
        properties: {
          baseCurrency: { type: "string", minLength: 3, maxLength: 3 },
          quoteCurrency: { type: "string", minLength: 3, maxLength: 3 },
          effectiveAt: { type: "string", format: "date-time" },
          rate: { type: "number", minimum: 0, exclusiveMinimum: true },
          source: { type: "string" }
        }
      },
      StatementCreate: {
        type: "object",
        required: ["accountId", "statementDate", "source", "lines"],
        properties: {
          accountId: { type: "string" },
          statementDate: { type: "string", format: "date" },
          source: { type: "string" },
          externalId: { type: "string" },
          lines: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              required: ["symbol", "quantity", "currency"],
              properties: {
                investmentId: { type: "string" },
                market: { type: "string" },
                symbol: { type: "string" },
                quantity: { type: "number", minimum: 0 },
                currency: { type: "string", minLength: 3, maxLength: 3 },
                totalCost: { type: "number", minimum: 0 },
                marketValue: { type: "number", minimum: 0 }
              }
            }
          }
        }
      },
      NewsCreate: {
        type: "object",
        required: ["source", "title", "publishedAt"],
        properties: {
          source: { type: "string" },
          url: { type: "string", format: "uri" },
          title: { type: "string" },
          summary: { type: "string" },
          body: { type: "string" },
          publishedAt: { type: "string", format: "date-time" },
          sourceId: { type: "string" },
          externalId: { type: "string" },
          canonicalUrl: { type: "string", format: "uri" },
          retrievedAt: { type: "string", format: "date-time" },
          language: { type: "string" },
          region: { type: "string" },
          topicTags: { type: "array", items: { type: "string" } },
          rawHash: { type: "string" },
          duplicateGroup: { type: "string" },
          relatedInvestmentIds: { type: "array", items: { type: "string" } }
        }
      },
      NewsSourceConfig: {
        type: "object",
        additionalProperties: false,
        properties: {
          fetchArticleContent: { type: "boolean" },
          dateField: { type: "string", enum: ["pubDate", "dc:date", "updated", "published"] },
          futureToleranceMinutes: { type: "integer", minimum: 0, maximum: 1440 },
          allowFutureEvents: { type: "boolean" },
          query: { type: "string" },
          section: { type: "string" },
          pageSize: { type: "integer", minimum: 1, maximum: 200 },
          candidateFilters: {
            type: "object",
            additionalProperties: false,
            properties: {
              whitelist: { type: "array", maxItems: 200, items: ref("NewsSourceCandidateFilterRule") },
              blacklist: { type: "array", maxItems: 200, items: ref("NewsSourceCandidateFilterRule") }
            }
          }
        }
      },
      NewsSourceCandidateFilterRule: {
        type: "object",
        required: ["value"],
        additionalProperties: false,
        properties: {
          value: { type: "string", minLength: 1, maxLength: 500 },
          mode: { type: "string", enum: ["contains", "word", "exact", "regex"], default: "contains" },
          target: { type: "string", enum: ["title", "category", "both"], default: "both" },
          enabled: { type: "boolean", default: true },
          reason: { type: "string", minLength: 1, maxLength: 500 }
        }
      },
      NewsSourceCreate: {
        type: "object",
        required: ["slug", "name", "adapterType", "endpoint"],
        properties: {
          slug: { type: "string", pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" },
          name: { type: "string" },
          adapterType: { type: "string", enum: ["rss", "guardian", "alpha_vantage", "gdelt", "commercial"] },
          endpoint: { type: "string", format: "uri" },
          enabled: { type: "boolean", default: false },
          priority: { type: "string", enum: ["core", "supporting", "optional", "fallback", "paid_core"] },
          editorialType: { type: "string", enum: ["news", "official_analysis", "research", "opinion", "advocacy", "aggregator"] },
          language: { type: "string" }, region: { type: "string" }, accessTier: { type: "string" },
          pollingIntervalMinutes: { type: "integer", minimum: 5, maximum: 1440 },
          staleAfterMinutes: { type: "integer", minimum: 5, maximum: 43200 },
          overlapMinutes: { type: "integer", minimum: 0, maximum: 1440 },
          requestTimeoutMs: { type: "integer", minimum: 1000, maximum: 120000 },
          maxResponseBytes: { type: "integer", minimum: 1024, maximum: 20000000 },
          maxConcurrency: { type: "integer", minimum: 1, maximum: 10 },
          secretRef: { type: "string" }, config: ref("NewsSourceConfig"), disabledReason: { type: "string" }
        }
      },
      NewsCollectionTrigger: {
        type: "object",
        properties: {
          sourceIds: { type: "array", maxItems: 50, items: { type: "string" } },
          mode: { type: "string", enum: ["due", "all_enabled", "selected"], default: "due" },
          trigger: { type: "string", enum: ["scheduled", "manual", "cli"], default: "manual" },
          from: { type: "string", format: "date-time" }, to: { type: "string", format: "date-time" },
          concurrency: { type: "integer", minimum: 1, maximum: 10, default: 3 }
        },
        description: "The requested interval must not exceed 24 hours."
      },
      WatchedAssetCreate: {
        allOf: [{ $ref: "#/components/schemas/InvestmentCreate" }]
      },
      VirtualPortfolioCreate: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string" },
          description: { type: "string" }
        }
      },
      VirtualPositionCreate: {
        type: "object",
        required: ["investmentId", "quantity"],
        properties: {
          investmentId: { type: "string" },
          quantity: { type: "number", minimum: 0 },
          targetWeight: { type: "number", minimum: 0, maximum: 1 }
        }
      },
      BenchmarkCreate: {
        type: "object",
        required: ["name", "symbol", "currency"],
        properties: {
          name: { type: "string" },
          symbol: { type: "string" },
          currency: { type: "string" },
          source: { type: "string" }
        }
      },
      BenchmarkObservationCreate: {
        type: "object",
        required: ["benchmarkId", "effectiveAt", "value", "currency", "source"],
        properties: {
          benchmarkId: { type: "string" },
          effectiveAt: { type: "string", format: "date-time" },
          value: { type: "number", minimum: 0, exclusiveMinimum: true },
          currency: { type: "string", minLength: 3, maxLength: 3 },
          source: { type: "string" }
        }
      },
      AnalyticsCompleteness: {
        type: "object",
        required: ["status", "diagnostics"],
        properties: {
          status: { type: "string", enum: ["complete", "partial", "unavailable"] },
          diagnostics: {
            type: "array",
            items: {
              type: "object",
              required: ["type", "severity"],
              properties: {
                type: { type: "string" },
                severity: { type: "string", enum: ["required", "advisory"] },
                date: { type: "string", format: "date" },
                source: { type: "string" }
              },
              additionalProperties: true
            }
          }
        }
      },
      SnapshotCreate: {
        type: "object",
        required: ["capturedAt", "positions"],
        properties: {
          capturedAt: { type: "string", format: "date-time" },
          source: { type: "string" },
          positions: {
            type: "array",
            items: {
              type: "object",
              required: ["investmentId", "quantity", "currency"],
              properties: {
                investmentId: { type: "string" },
                quantity: { type: "number", minimum: 0 },
                currency: { type: "string" }
              }
            }
          }
        }
      },
      ProcessingUpdate: {
        type: "object",
        required: ["actor"],
        properties: {
          actor: { type: "string" },
          notes: { type: "string" }
        }
      },
      Health: {
        type: "object", required: ["status"],
        properties: { status: { type: "string", enum: ["ok"] } }
      },
      OpenApiDocument: {
        type: "object", required: ["openapi", "info", "paths"],
        properties: {
          openapi: { type: "string" },
          info: { type: "object", additionalProperties: true },
          paths: { type: "object", additionalProperties: true }
        },
        additionalProperties: true
      },
      Portfolio: {
        type: "object", required: ["id", "name", "baseCurrency", "reliableFrom", "createdAt", "updatedAt"],
        properties: {
          id: { type: "string" }, name: { type: "string" },
          baseCurrency: { type: "string" }, reliableFrom: { type: "string", format: "date" },
          createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" }
        }
      },
      BrokerageAccount: {
        type: "object", required: ["id", "portfolioId", "name", "active", "createdAt", "updatedAt"],
        properties: {
          id: { type: "string" }, portfolioId: { type: "string" }, name: { type: "string" },
          institution: { type: "string" }, externalId: { type: "string" }, active: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" }
        }
      },
      Investment: {
        allOf: [
          ref("InvestmentCreate"),
          {
            type: "object", required: ["id", "active", "createdAt", "updatedAt"],
            properties: {
              id: { type: "string" }, active: { type: "boolean" },
              createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" }
            }
          }
        ]
      },
      OpeningPosition: {
        allOf: [
          ref("OpeningPositionCreate"),
          {
            type: "object", required: ["id", "portfolioId", "accountId", "createdAt", "updatedAt"],
            properties: {
              id: { type: "string" }, portfolioId: { type: "string" }, accountId: { type: "string" },
              createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" }
            }
          }
        ]
      },
      Operation: {
        allOf: [
          ref("OperationCreate"),
          {
            type: "object", required: ["id", "accountId", "version", "createdAt", "updatedAt"],
            properties: {
              id: { type: "string" }, version: { type: "integer" }, payloadHash: { type: "string" },
              importResult: { type: "string", enum: ["created", "replayed"] },
              reviewedAt: { type: "string", format: "date-time" }, reviewedBy: { type: "string" },
              reviewNotes: { type: "string" }, createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" }
            }
          }
        ]
      },
      OperationRevisionRecord: {
        type: "object", required: ["id", "operationId", "version", "actor", "reason", "before", "after", "createdAt", "updatedAt"],
        properties: {
          id: { type: "string" }, operationId: { type: "string" }, version: { type: "integer" },
          actor: { type: "string" }, reason: { type: "string" }, before: ref("Operation"), after: ref("Operation"),
          createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" }
        }
      },
      NewsItem: {
        allOf: [
          ref("NewsCreate"),
          {
            type: "object", required: ["id", "relatedInvestmentIds", "createdAt", "updatedAt"],
            properties: {
              id: { type: "string" }, processedAt: { type: "string", format: "date-time" },
              processedBy: { type: "string" }, processingNotes: { type: "string" },
              createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" }
            }
          }
        ]
      },
      NewsStoryClassificationSource: {
        type: "object",
        required: ["type"],
        properties: {
          type: { type: "string", enum: ["none", "story_cluster", "news_item", "conflict"] },
          classificationId: { type: "string" },
          newsId: { type: "string" }
        }
      },
      NewsStoryMention: {
        type: "object",
        required: ["id", "storyId", "newsId", "matchReason", "confidence", "isPrimary", "diagnostics", "createdAt", "updatedAt"],
        properties: {
          id: { type: "string" }, storyId: { type: "string" }, newsId: { type: "string" }, sourceId: { type: "string" },
          matchReason: { type: "string", enum: ["canonical_url", "semantic", "manual", "backfill"] },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          isPrimary: { type: "boolean" }, diagnostics: { type: "array", items: { type: "string" } },
          createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" }
        }
      },
      NewsStoryCluster: {
        type: "object",
        required: ["id", "publicationDate", "title", "primaryNewsId", "status", "primaryNews", "alsoSeenIn", "mentions", "sourceCount", "classificationSource", "createdAt", "updatedAt"],
        properties: {
          id: { type: "string" }, publicationDate: { type: "string", format: "date" }, title: { type: "string" },
          summary: { type: "string" }, primaryNewsId: { type: "string" }, canonicalUrl: { type: "string", format: "uri" },
          semanticKey: { type: "string" }, status: { type: "string", enum: ["active", "needs_review", "conflicting_classifications"] },
          reviewReason: { type: "string" }, primaryNews: ref("NewsItem"),
          alsoSeenIn: { type: "array", items: ref("NewsItem") },
          mentions: { type: "array", items: ref("NewsStoryMention") },
          sourceCount: { type: "integer" },
          classificationSource: ref("NewsStoryClassificationSource"),
          createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" }
        }
      },
      NewsSourceHealth: {
        type: "object", required: ["status", "consecutiveFailures"],
        properties: {
          status: { type: "string", enum: ["healthy", "stale", "failing", "never_collected", "disabled"] },
          latestItemAt: { type: "string", format: "date-time" }, lastSuccessAt: { type: "string", format: "date-time" },
          consecutiveFailures: { type: "integer" }
        }
      },
      NewsSource: {
        allOf: [
          ref("NewsSourceCreate"),
          {
            type: "object", required: ["id", "enabled", "priority", "editorialType", "accessTier", "pollingIntervalMinutes",
              "staleAfterMinutes", "overlapMinutes", "requestTimeoutMs", "maxResponseBytes", "maxConcurrency", "config", "createdAt", "updatedAt"],
            properties: {
              id: { type: "string" }, health: ref("NewsSourceHealth"), state: { type: "object", additionalProperties: true },
              createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" }
            }
          }
        ]
      },
      NewsCollectionCounts: {
        type: "object", required: ["fetched", "accepted", "created", "enriched", "duplicates", "rejected", "articleFailures"],
        properties: {
          fetched: { type: "integer" }, accepted: { type: "integer" }, created: { type: "integer" },
          enriched: { type: "integer" }, duplicates: { type: "integer" }, rejected: { type: "integer" },
          articleFailures: { type: "integer" }
        }
      },
      NewsCollectionRun: {
        type: "object", required: ["id", "sourceId", "trigger", "windowFrom", "windowTo", "status", "startedAt", "counts", "diagnostics", "createdAt", "updatedAt"],
        properties: {
          id: { type: "string" }, sourceId: { type: "string" },
          trigger: { type: "string", enum: ["scheduled", "manual", "cli"] },
          windowFrom: { type: "string", format: "date-time" }, windowTo: { type: "string", format: "date-time" },
          status: { type: "string", enum: ["running", "success", "no_change", "partial", "failed", "rate_limited", "skipped"] },
          startedAt: { type: "string", format: "date-time" }, completedAt: { type: "string", format: "date-time" },
          counts: ref("NewsCollectionCounts"), diagnostics: { type: "array", items: { type: "string" } },
          errorCode: { type: "string" }, createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" }
        }
      },
      NewsCollectionTriggerResult: {
        oneOf: [
          ref("NewsCollectionRun"),
          {
            type: "object", required: ["sourceId", "status", "reason"],
            properties: { sourceId: { type: "string" }, status: { type: "string", enum: ["skipped"] }, reason: { type: "string" } }
          }
        ]
      },
      ClassificationEvidence: {
        type: "object", required: ["key", "sourceField", "explanation"],
        properties: {
          id: { type: "string" }, key: { type: "string" },
          sourceField: { type: "string", enum: ["title", "summary", "body"] },
          excerpt: { type: "string" }, explanation: { type: "string" }
        }
      },
      ClassificationTarget: {
        type: "object", required: ["targetType", "direction", "magnitude", "confidence", "rationale", "evidenceKeys"],
        properties: {
          id: { type: "string" }, classificationId: { type: "string" },
          targetType: { type: "string", enum: ["country", "currency", "sector", "company", "investment"] },
          targetKey: { type: "string" }, investmentId: { type: "string" }, companyName: { type: "string" },
          market: { type: "string" }, symbol: { type: "string" },
          direction: { type: "string", enum: ["positive", "negative", "mixed", "neutral", "uncertain"] },
          magnitude: { type: "string", enum: ["low", "medium", "high", "unknown"] },
          confidence: { type: "number", minimum: 0, maximum: 1 }, rationale: { type: "string" },
          evidenceKeys: { type: "array", items: { type: "string" } }
        }
      },
      NewsClassificationCreate: {
        type: "object", additionalProperties: false,
        required: ["classifierId", "classifierType", "classifierVersion", "externalRunId", "importance", "scope", "horizon", "overallConfidence"],
        properties: {
          classifierId: { type: "string" }, classifierType: { type: "string", enum: ["agent", "rule", "human"] },
          classifierVersion: { type: "string" }, externalRunId: { type: "string" },
          importance: { type: "string", enum: ["low", "medium", "high", "critical"] },
          scope: { type: "string", enum: ["global", "country", "sector", "company", "mixed"] },
          horizon: { type: "string", enum: ["immediate", "short_term", "medium_term", "long_term"] },
          overallConfidence: { type: "number", minimum: 0, maximum: 1 },
          tags: { type: "array", items: { type: "string" }, maxItems: 50 },
          countries: { type: "array", items: { type: "string", minLength: 2, maxLength: 2 }, maxItems: 50 },
          currencies: { type: "array", items: { type: "string", minLength: 3, maxLength: 3 }, maxItems: 50 },
          sectors: { type: "array", maxItems: 50, items: { type: "object", required: ["taxonomy", "code"], properties: {
            taxonomy: { type: "string" }, code: { type: "string" }, label: { type: "string" }
          } } },
          evidence: { type: "array", maxItems: 30, items: ref("ClassificationEvidence") },
          targets: { type: "array", maxItems: 100, items: ref("ClassificationTarget") },
          supersedesClassificationId: { type: "string" }
        }
      },
      NewsClassification: {
        allOf: [
          ref("NewsClassificationCreate"),
          { type: "object", required: ["id", "newsId", "payloadHash", "tags", "countries", "currencies", "sectors", "evidence", "targets", "createdAt", "updatedAt"],
            properties: {
              id: { type: "string" }, newsId: { type: "string" }, payloadHash: { type: "string" },
              importResult: { type: "string", enum: ["created", "replayed"] },
              reviews: { type: "array", items: ref("ClassificationReview") },
              effectiveReview: ref("ClassificationReview"),
              createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" }
            } }
        ]
      },
      ClassificationReviewCreate: {
        type: "object", additionalProperties: false, required: ["reviewer", "decision"],
        properties: {
          reviewer: { type: "string" }, decision: { type: "string", enum: ["approved", "rejected", "needs_revision"] },
          notes: { type: "string" }
        }
      },
      ClassificationReview: {
        allOf: [ref("ClassificationReviewCreate"), { type: "object", required: ["id", "classificationId", "createdAt", "updatedAt"],
          properties: { id: { type: "string" }, classificationId: { type: "string" },
            createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" } } }]
      },
      ClassificationResolutionCreate: {
        type: "object", additionalProperties: false, required: ["investmentId", "actor", "reason"],
        properties: { investmentId: { type: "string" }, actor: { type: "string" }, reason: { type: "string" } }
      },
      ClassificationResolution: {
        allOf: [ref("ClassificationResolutionCreate"), { type: "object", required: ["id", "targetId", "createdAt", "updatedAt"],
          properties: { id: { type: "string" }, targetId: { type: "string" },
            createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" } } }]
      },
      ClassificationPage: {
        type: "object", required: ["items", "total", "offset", "limit"],
        properties: {
          items: { type: "array", items: ref("NewsClassification") }, total: { type: "integer" },
          offset: { type: "integer" }, limit: { type: "integer" }
        }
      },
      WatchedAsset: {
        type: "object", required: ["id", "symbol", "name", "assetClass", "currency", "active", "createdAt", "updatedAt"],
        properties: {
          id: { type: "string" }, symbol: { type: "string" }, name: { type: "string" },
          assetClass: { type: "string" }, currency: { type: "string" }, market: { type: "string" },
          country: { type: "string" }, active: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" }
        }
      },
      VirtualPortfolio: {
        allOf: [
          ref("VirtualPortfolioCreate"),
          {
            type: "object", required: ["id", "createdAt", "updatedAt"],
            properties: {
              id: { type: "string" }, createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" }
            }
          }
        ]
      },
      VirtualPosition: {
        allOf: [
          ref("VirtualPositionCreate"),
          {
            type: "object", required: ["id", "virtualPortfolioId", "createdAt", "updatedAt"],
            properties: {
              id: { type: "string" }, virtualPortfolioId: { type: "string" },
              createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" }
            }
          }
        ]
      },
      VirtualComparison: {
        type: "object", required: ["investment", "realQuantity", "virtualQuantity", "quantityDifference"],
        properties: {
          investment: ref("Investment"), realQuantity: { type: "number" },
          virtualQuantity: { type: "number" }, quantityDifference: { type: "number" }
        }
      },
      Benchmark: {
        allOf: [
          ref("BenchmarkCreate"),
          {
            type: "object", required: ["id", "createdAt", "updatedAt"],
            properties: {
              id: { type: "string" }, createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" }
            }
          }
        ]
      },
      BenchmarkObservation: {
        allOf: [
          ref("BenchmarkObservationCreate"),
          {
            type: "object", required: ["id", "createdAt", "updatedAt"],
            properties: {
              id: { type: "string" }, createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" }
            }
          }
        ]
      },
      PriceObservation: {
        allOf: [
          ref("PriceCreate"),
          {
            type: "object", required: ["id", "createdAt", "updatedAt"],
            properties: {
              id: { type: "string" }, createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" }
            }
          }
        ]
      },
      FxRate: {
        allOf: [
          ref("FxRateCreate"),
          {
            type: "object", required: ["id", "createdAt", "updatedAt"],
            properties: {
              id: { type: "string" }, createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" }
            }
          }
        ]
      },
      SnapshotPosition: {
        type: "object", required: ["investmentId", "quantity", "currency"],
        properties: { investmentId: { type: "string" }, quantity: { type: "number" }, currency: { type: "string" } }
      },
      PortfolioSnapshot: {
        type: "object", required: ["id", "capturedAt", "positions", "createdAt", "updatedAt"],
        properties: {
          id: { type: "string" }, capturedAt: { type: "string", format: "date-time" }, source: { type: "string" },
          positions: { type: "array", items: ref("SnapshotPosition") },
          createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" }
        }
      },
      StatementLine: {
        type: "object", required: ["id", "symbol", "quantity", "currency", "resolved"],
        properties: {
          id: { type: "string" }, investmentId: { type: "string" }, market: { type: "string" },
          symbol: { type: "string" }, quantity: { type: "number" }, currency: { type: "string" },
          totalCost: { type: "number" }, marketValue: { type: "number" }, resolved: { type: "boolean" }
        }
      },
      PortfolioStatement: {
        type: "object", required: ["id", "accountId", "statementDate", "source", "lines", "createdAt", "updatedAt"],
        properties: {
          id: { type: "string" }, accountId: { type: "string" }, statementDate: { type: "string", format: "date" },
          source: { type: "string" }, externalId: { type: "string" },
          lines: { type: "array", items: ref("StatementLine") },
          createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" }
        }
      },
      ReconciliationResult: {
        type: "object",
        required: ["market", "symbol", "reportedQuantity", "calculatedQuantity", "quantityDifference", "status", "costAvailable", "marketValueAvailable"],
        properties: {
          investmentId: { type: "string" }, market: { type: "string" }, symbol: { type: "string" },
          reportedQuantity: { type: "number" }, calculatedQuantity: { type: "number" }, quantityDifference: { type: "number" },
          status: { type: "string", enum: ["matched", "discrepancy", "unresolved", "statement_only", "ledger_only"] },
          reportedCost: { type: "number" }, calculatedCost: { type: "number" }, costDifference: { type: "number" },
          costAvailable: { type: "boolean" }, reportedMarketValue: { type: "number" },
          calculatedMarketValue: { type: "number" }, marketValueDifference: { type: "number" },
          marketValueAvailable: { type: "boolean" }
        },
        additionalProperties: true
      },
      Reconciliation: {
        type: "object", required: ["id", "statementId", "accountId", "statementDate", "status", "results", "createdAt", "updatedAt"],
        properties: {
          id: { type: "string" }, statementId: { type: "string" }, accountId: { type: "string" },
          statementDate: { type: "string", format: "date" }, status: { type: "string", enum: ["matched", "discrepancies"] },
          results: { type: "array", items: ref("ReconciliationResult") },
          createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" }
        }
      },
      PortfolioPosition: {
        type: "object",
        required: ["investment", "accountId", "quantity", "costStatus", "unknownCostQuantity", "reliableFrom", "reliable"],
        properties: {
          investment: ref("Investment"), accountId: { type: "string" }, quantity: { type: "number" },
          totalCost: { type: "number" }, costStatus: { type: "string", enum: ["known", "partial", "unknown"] },
          unknownCostQuantity: { type: "number" }, reliableFrom: { type: "string", format: "date" },
          reliable: { type: "boolean" }
        }
      },
      ValuedPosition: {
        allOf: [
          ref("PortfolioPosition"),
          {
            type: "object", required: ["baseCurrency", "valuationStatus", "completeness"],
            properties: {
              baseCurrency: { type: "string" }, valuationStatus: { type: "string", enum: ["available", "unavailable"] },
              originalValue: { type: "number" }, baseValue: { type: "number" }, originalGainLoss: { type: "number" },
              price: ref("PriceObservation"), fx: ref("FxRate"), fxInverted: { type: "boolean" },
              missing: { type: "object", additionalProperties: true }, completeness: ref("AnalyticsCompleteness")
            }
          }
        ]
      },
      Allocation: {
        type: "object", required: ["key", "quantity"],
        properties: { key: { type: "string" }, quantity: { type: "number" } }
      },
      ValuedAllocation: {
        type: "object", required: ["key", "baseCurrency", "baseValue", "unavailablePositions", "completeness"],
        properties: {
          key: { type: "string" }, baseCurrency: { type: "string" }, baseValue: { type: "number" },
          weight: { type: "number" },
          unavailablePositions: {
            type: "array", items: {
              type: "object", required: ["investmentId"],
              properties: { investmentId: { type: "string" }, missing: { type: "object", additionalProperties: true } }
            }
          },
          completeness: ref("AnalyticsCompleteness")
        }
      },
      ExternalFlowValue: {
        type: "object", required: ["operationId", "type", "date", "diagnostics"],
        properties: {
          operationId: { type: "string" }, type: { type: "string", enum: ["contribution", "withdrawal"] },
          date: { type: "string", format: "date" }, originalValue: { type: "number" },
          originalCurrency: { type: "string" }, baseValue: { type: "number" },
          priceObservationId: { type: "string" }, fxObservationId: { type: "string" },
          fxInverted: { type: "boolean" },
          diagnostics: { type: "array", items: { type: "object", additionalProperties: true } }
        }
      },
      PortfolioAnalytics: {
        type: "object",
        required: ["portfolioId", "date", "reliableFrom", "baseCurrency", "contributions", "withdrawals", "netExternalFlow", "formula", "flowProvenance", "completeness"],
        properties: {
          portfolioId: { type: "string" }, date: { type: "string", format: "date" },
          reliableFrom: { type: "string", format: "date" }, baseCurrency: { type: "string" },
          marketValue: { type: "number" }, openingValue: { type: "number" }, contributions: { type: "number" },
          withdrawals: { type: "number" }, netExternalFlow: { type: "number" }, gainLoss: { type: "number" },
          formula: { type: "string" }, flowProvenance: { type: "array", items: ref("ExternalFlowValue") },
          completeness: ref("AnalyticsCompleteness")
        }
      },
      ConcentrationAsset: {
        type: "object", required: ["investment", "baseValue"],
        properties: { investment: ref("Investment"), baseValue: { type: "number" }, weight: { type: "number" } }
      },
      Concentration: {
        type: "object", required: ["date", "baseCurrency", "requestedTop", "totalMarketValue", "assets", "completeness"],
        properties: {
          date: { type: "string", format: "date" }, baseCurrency: { type: "string" },
          requestedTop: { type: "integer" }, totalMarketValue: { type: "number" },
          assets: { type: "array", items: ref("ConcentrationAsset") },
          topWeight: { type: "number" }, remainingWeight: { type: "number" },
          completeness: ref("AnalyticsCompleteness")
        }
      },
      EvolutionSample: {
        type: "object", required: ["date", "analytics"],
        properties: {
          date: { type: "string", format: "date" }, analytics: ref("PortfolioAnalytics"),
          portfolioIndex: { type: "number" }, benchmarkIndex: { type: "number" },
          benchmark: {
            type: "object",
            properties: {
              value: { type: "number" }, observation: ref("BenchmarkObservation"),
              diagnostic: { type: "object", additionalProperties: true }
            }
          }
        }
      },
      PortfolioEvolution: {
        type: "object", required: ["portfolioId", "from", "to", "interval", "baseCurrency", "samples"],
        properties: {
          portfolioId: { type: "string" }, from: { type: "string", format: "date" },
          to: { type: "string", format: "date" }, interval: { type: "string", enum: ["daily", "weekly", "monthly"] },
          baseCurrency: { type: "string" }, benchmark: ref("Benchmark"),
          normalizationDate: { type: "string", format: "date" },
          samples: { type: "array", items: ref("EvolutionSample") }
        }
      },
      DailyPackage: {
        type: "object", required: ["date", "currentPortfolio", "news", "recentOperations", "pending"],
        properties: {
          date: { type: "string", format: "date" },
          currentPortfolio: { type: "array", items: ref("PortfolioPosition") },
          news: { type: "array", items: ref("NewsItem") },
          recentOperations: { type: "array", items: ref("Operation") },
          pending: ref("PendingWork")
        }
      },
      ChangeRecord: {
        type: "object", required: ["type", "id", "updatedAt"],
        properties: {
          type: { type: "string" }, id: { type: "string" }, updatedAt: { type: "string", format: "date-time" }
        }
      },
      ChangesResponse: {
        type: "object", required: ["cursor", "changes"],
        properties: {
          cursor: { type: "string", format: "date-time" },
          changes: { type: "array", items: ref("ChangeRecord") }
        }
      },
      PendingWork: {
        type: "object", required: ["news", "unclassifiedNews", "classificationReviews", "operations", "snapshots"],
        properties: {
          news: {
            type: "array", items: {
              type: "object", required: ["id", "title", "publishedAt"],
              properties: { id: { type: "string" }, title: { type: "string" }, publishedAt: { type: "string", format: "date-time" } }
            }
          },
          unclassifiedNews: {
            type: "array", items: {
              type: "object", required: ["id", "title", "publishedAt"],
              properties: { id: { type: "string" }, title: { type: "string" }, publishedAt: { type: "string", format: "date-time" } }
            }
          },
          classificationReviews: {
            type: "array", items: {
              type: "object", required: ["id", "newsId"],
              properties: { id: { type: "string" }, newsId: { type: "string" } }
            }
          },
          operations: {
            type: "array", items: {
              type: "object", required: ["id", "investmentId", "type", "effectiveDate"],
              properties: {
                id: { type: "string" }, investmentId: { type: "string" },
                type: { type: "string" }, effectiveDate: { type: "string", format: "date" }
              }
            }
          },
          snapshots: {
            type: "array", items: {
              type: "object", required: ["reason"], properties: { reason: { type: "string" } }
            }
          }
        }
      }
    }
  },
  paths: {
    "/health": { get: { summary: "Healthcheck", responses: { "200": resourceResponse("Service liveness", "Health") } } },
    "/openapi.json": { get: { summary: "OpenAPI document", responses: { "200": resourceResponse("OpenAPI document", "OpenApiDocument") } } },
    "/v1/investments": {
      get: { security: auth, summary: "List investments", responses: { "200": collectionResponse("Investments", "Investment"), "401": errorResponse } },
      post: { security: auth, summary: "Create investment", requestBody: body("InvestmentCreate"), responses: { "201": resourceResponse("Investment", "Investment"), "400": errorResponse, "401": errorResponse } }
    },
    "/v1/investments/{id}": {
      get: { security: auth, summary: "Get investment", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": resourceResponse("Investment", "Investment"), "404": errorResponse } },
      patch: { security: auth, summary: "Update investment", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], requestBody: body("InvestmentCreate"), responses: { "200": resourceResponse("Investment", "Investment"), "400": errorResponse, "404": errorResponse } }
    },
    "/v1/investments/{id}/deactivate": { post: { security: auth, summary: "Deactivate investment", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": resourceResponse("Investment", "Investment"), "404": errorResponse } } },
    "/v1/assets": {
      get: { security: auth, summary: "List stable assets", responses: { "200": collectionResponse("Assets", "Investment"), "401": errorResponse } },
      post: { security: auth, summary: "Create stable asset identified by market and symbol", requestBody: body("InvestmentCreate"), responses: { "201": resourceResponse("Asset", "Investment"), "400": errorResponse, "409": errorResponse } }
    },
    "/v1/assets/{id}": {
      get: { security: auth, summary: "Get stable asset", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": resourceResponse("Asset", "Investment"), "404": errorResponse } }
    },
    "/v1/portfolios/{id}": {
      get: { security: auth, summary: "Get portfolio configuration", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": resourceResponse("Portfolio", "Portfolio"), "404": errorResponse } },
      patch: { security: auth, summary: "Update base currency or reliable history boundary", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], requestBody: body("PortfolioPatch"), responses: { "200": resourceResponse("Portfolio", "Portfolio"), "400": errorResponse, "404": errorResponse } }
    },
    "/v1/accounts": {
      get: { security: auth, summary: "List brokerage accounts", responses: { "200": collectionResponse("Brokerage accounts", "BrokerageAccount") } },
      post: { security: auth, summary: "Create brokerage account", requestBody: body("BrokerageAccountCreate"), responses: { "201": resourceResponse("Brokerage account", "BrokerageAccount"), "400": errorResponse, "409": errorResponse } }
    },
    "/v1/accounts/{id}": {
      get: { security: auth, summary: "Get brokerage account", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": resourceResponse("Brokerage account", "BrokerageAccount"), "404": errorResponse } }
    },
    "/v1/opening-positions": {
      get: { security: auth, summary: "List explicit opening positions", responses: { "200": collectionResponse("Opening positions", "OpeningPosition") } },
      post: { security: auth, summary: "Create opening position at reliableFrom", requestBody: body("OpeningPositionCreate"), responses: { "201": resourceResponse("Opening position", "OpeningPosition"), "400": errorResponse, "409": errorResponse } }
    },
    "/v1/operations": {
      get: { security: auth, summary: "List operations", responses: { "200": collectionResponse("Operations", "Operation") } },
      post: { security: auth, summary: "Create or idempotently replay operation", requestBody: body("OperationCreate"), responses: { "200": resourceResponse("Existing operation replay", "Operation"), "201": resourceResponse("Created operation", "Operation"), "400": errorResponse, "409": errorResponse } }
    },
    "/v1/operations/{id}": {
      get: { security: auth, summary: "Get operation", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": resourceResponse("Operation", "Operation"), "404": errorResponse } },
      patch: { security: auth, summary: "Revise operation with optimistic concurrency and audit reason", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], requestBody: body("OperationRevision"), responses: { "200": resourceResponse("Revised operation", "Operation"), "400": errorResponse, "409": errorResponse } }
    },
    "/v1/operations/{id}/revisions": { get: { security: auth, summary: "List immutable operation revisions", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": collectionResponse("Operation revisions", "OperationRevisionRecord"), "404": errorResponse } } },
    "/v1/operations/{id}/review": { post: { security: auth, summary: "Mark operation reviewed", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], requestBody: body("ProcessingUpdate"), responses: { "200": resourceResponse("Operation", "Operation"), "404": errorResponse } } },
    "/v1/news": {
      get: { security: auth, summary: "List news", responses: { "200": collectionResponse("News", "NewsItem") } },
      post: { security: auth, summary: "Create news", requestBody: body("NewsCreate"), responses: { "201": resourceResponse("News item", "NewsItem"), "400": errorResponse } }
    },
    "/v1/news/{id}": {
      get: { security: auth, summary: "Get news", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": resourceResponse("News item", "NewsItem"), "404": errorResponse } },
      patch: { security: auth, summary: "Update news", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], requestBody: body("NewsCreate"), responses: { "200": resourceResponse("News item", "NewsItem"), "404": errorResponse } }
    },
    "/v1/news-stories": {
      get: {
        security: auth, summary: "List clustered news stories",
        parameters: [
          { name: "date", in: "query", schema: { type: "string", format: "date" } },
          { name: "status", in: "query", schema: { type: "string", enum: ["active", "needs_review", "conflicting_classifications"] } },
          { name: "unclassified", in: "query", schema: { type: "boolean" } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 200, default: 100 } }
        ],
        responses: { "200": collectionResponse("Story clusters", "NewsStoryCluster") }
      }
    },
    "/v1/news-stories/{id}": {
      get: { security: auth, summary: "Get clustered news story", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": resourceResponse("Story cluster", "NewsStoryCluster"), "404": errorResponse } }
    },
    "/v1/news/{id}/process": { post: { security: auth, summary: "Mark news processed", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], requestBody: body("ProcessingUpdate"), responses: { "200": resourceResponse("News item", "NewsItem"), "404": errorResponse } } },
    "/v1/news/{id}/classifications": {
      get: {
        security: auth, summary: "List current or historical classifications for news",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "current", in: "query", schema: { type: "boolean", default: false } }
        ],
        responses: { "200": collectionResponse("News classifications", "NewsClassification"), "404": errorResponse }
      },
      post: {
        security: auth, summary: "Create or idempotently replay an agent-generated news classification",
        requestBody: body("NewsClassificationCreate"),
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": resourceResponse("Replayed classification", "NewsClassification"),
          "201": resourceResponse("Created classification", "NewsClassification"),
          "400": errorResponse, "404": errorResponse, "409": errorResponse
        }
      }
    },
    "/v1/news-classifications": {
      get: {
        security: auth, summary: "Query current or historical news classifications",
        parameters: [
          { name: "newsId", in: "query", schema: { type: "string" } },
          { name: "classifierId", in: "query", schema: { type: "string" } },
          { name: "importance", in: "query", schema: { type: "string", enum: ["low", "medium", "high", "critical"] } },
          { name: "reviewStatus", in: "query", schema: { type: "string", enum: ["unreviewed", "approved", "rejected", "needs_revision"] } },
          { name: "country", in: "query", schema: { type: "string" } }, { name: "currency", in: "query", schema: { type: "string" } },
          { name: "sector", in: "query", schema: { type: "string" } }, { name: "investmentId", in: "query", schema: { type: "string" } },
          { name: "company", in: "query", schema: { type: "string" } }, { name: "direction", in: "query", schema: { type: "string" } },
          { name: "minConfidence", in: "query", schema: { type: "number", minimum: 0, maximum: 1 } },
          { name: "from", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "to", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "current", in: "query", schema: { type: "boolean", default: true } },
          { name: "offset", in: "query", schema: { type: "integer", minimum: 0, default: 0 } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 200, default: 50 } }
        ],
        responses: { "200": resourceResponse("Classification page", "ClassificationPage"), "400": errorResponse }
      }
    },
    "/v1/news-classifications/{id}": {
      get: { security: auth, summary: "Get classification with review state", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": resourceResponse("News classification", "NewsClassification"), "404": errorResponse } }
    },
    "/v1/news-classifications/{id}/reviews": {
      get: { security: auth, summary: "List append-only classification reviews", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": collectionResponse("Classification reviews", "ClassificationReview"), "404": errorResponse } },
      post: { security: auth, summary: "Append classification review", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], requestBody: body("ClassificationReviewCreate"), responses: { "201": resourceResponse("Classification review", "ClassificationReview"), "400": errorResponse, "404": errorResponse } }
    },
    "/v1/news-classification-targets/{id}/resolutions": {
      get: { security: auth, summary: "List company-target investment resolutions", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": collectionResponse("Target resolutions", "ClassificationResolution") } },
      post: { security: auth, summary: "Resolve company target to investment", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], requestBody: body("ClassificationResolutionCreate"), responses: { "201": resourceResponse("Target resolution", "ClassificationResolution"), "400": errorResponse, "404": errorResponse } }
    },
    "/v1/news-classification-queue": {
      get: {
        security: auth, summary: "List classification or review work",
        parameters: [
          { name: "kind", in: "query", required: true, schema: { type: "string", enum: ["unclassified", "unreviewed", "needs_revision"] } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 200, default: 100 } }
        ],
        responses: { "200": jsonResponse("Classification work items", { type: "array", items: { oneOf: [ref("NewsStoryCluster"), ref("NewsClassification")] } }), "400": errorResponse }
      }
    },
    "/v1/news-sources": {
      get: {
        security: auth, summary: "List registered news sources and health",
        parameters: [
          { name: "enabled", in: "query", schema: { type: "boolean" } },
          { name: "priority", in: "query", schema: { type: "string" } },
          { name: "editorialType", in: "query", schema: { type: "string" } }
        ],
        responses: { "200": collectionResponse("News sources", "NewsSource") }
      },
      post: { security: auth, summary: "Register news source", requestBody: body("NewsSourceCreate"), responses: { "201": resourceResponse("News source", "NewsSource"), "400": errorResponse, "409": errorResponse } }
    },
    "/v1/news-sources/{id}": {
      get: { security: auth, summary: "Get news source, state, and health", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": resourceResponse("News source", "NewsSource"), "404": errorResponse } },
      patch: { security: auth, summary: "Update news source", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], requestBody: body("NewsSourceCreate"), responses: { "200": resourceResponse("News source", "NewsSource"), "400": errorResponse, "404": errorResponse, "409": errorResponse } }
    },
    "/v1/news-collection-runs": {
      get: {
        security: auth, summary: "List news collection runs",
        parameters: [
          { name: "sourceId", in: "query", schema: { type: "string" } },
          { name: "status", in: "query", schema: { type: "string" } },
          { name: "trigger", in: "query", schema: { type: "string" } },
          { name: "from", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "to", in: "query", schema: { type: "string", format: "date-time" } }
        ],
        responses: { "200": collectionResponse("Collection runs", "NewsCollectionRun") }
      },
      post: {
        security: auth, summary: "Trigger bounded news collection",
        description: "Each source collection is isolated and limited to the latest 24 hours.",
        requestBody: body("NewsCollectionTrigger"),
        responses: { "202": collectionResponse("Per-source collection results", "NewsCollectionTriggerResult"), "400": errorResponse }
      }
    },
    "/v1/news-collection-runs/{id}": {
      get: { security: auth, summary: "Get news collection run", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": resourceResponse("Collection run", "NewsCollectionRun"), "404": errorResponse } }
    },
    "/v1/watched-assets": {
      get: { security: auth, summary: "List watched assets", responses: { "200": collectionResponse("Watched assets", "WatchedAsset") } },
      post: { security: auth, summary: "Create watched asset", requestBody: body("WatchedAssetCreate"), responses: { "201": resourceResponse("Watched asset", "WatchedAsset") } }
    },
    "/v1/virtual-portfolios": {
      get: { security: auth, summary: "List virtual portfolios", responses: { "200": collectionResponse("Virtual portfolios", "VirtualPortfolio") } },
      post: { security: auth, summary: "Create virtual portfolio", requestBody: body("VirtualPortfolioCreate"), responses: { "201": resourceResponse("Virtual portfolio", "VirtualPortfolio") } }
    },
    "/v1/virtual-portfolios/{portfolioId}/positions": { post: { security: auth, summary: "Create virtual position", parameters: [{ name: "portfolioId", in: "path", required: true, schema: { type: "string" } }], requestBody: body("VirtualPositionCreate"), responses: { "201": resourceResponse("Virtual position", "VirtualPosition") } } },
    "/v1/virtual-portfolios/{portfolioId}/compare": { get: { security: auth, summary: "Compare real and virtual portfolio", parameters: [{ name: "portfolioId", in: "path", required: true, schema: { type: "string" } }], responses: { "200": collectionResponse("Comparison", "VirtualComparison") } } },
    "/v1/benchmarks": {
      get: { security: auth, summary: "List benchmarks", responses: { "200": collectionResponse("Benchmarks", "Benchmark") } },
      post: { security: auth, summary: "Create benchmark", requestBody: body("BenchmarkCreate"), responses: { "201": resourceResponse("Benchmark", "Benchmark") } }
    },
    "/v1/benchmark-observations": {
      get: {
        security: auth, summary: "List immutable historical benchmark observations",
        parameters: [{ name: "benchmarkId", in: "query", schema: { type: "string" } }],
        responses: { "200": collectionResponse("Benchmark observations", "BenchmarkObservation") }
      },
      post: {
        security: auth, summary: "Create immutable historical benchmark observation",
        requestBody: body("BenchmarkObservationCreate"),
        responses: { "201": resourceResponse("Benchmark observation", "BenchmarkObservation"), "400": errorResponse, "404": errorResponse }
      }
    },
    "/v1/snapshots": { post: { security: auth, summary: "Create snapshot", requestBody: body("SnapshotCreate"), responses: { "201": resourceResponse("Snapshot", "PortfolioSnapshot") } } },
    "/v1/snapshots/latest": { get: { security: auth, summary: "Latest snapshot", responses: { "200": jsonResponse("Snapshot or null", { allOf: [ref("PortfolioSnapshot")], nullable: true }) } } },
    "/v1/prices": {
      get: { security: auth, summary: "List historical asset price observations", responses: { "200": collectionResponse("Price observations", "PriceObservation") } },
      post: { security: auth, summary: "Create immutable price observation", requestBody: body("PriceCreate"), responses: { "201": resourceResponse("Price observation", "PriceObservation"), "400": errorResponse } }
    },
    "/v1/fx-rates": {
      get: { security: auth, summary: "List historical FX observations", responses: { "200": collectionResponse("FX observations", "FxRate") } },
      post: { security: auth, summary: "Create immutable FX observation", requestBody: body("FxRateCreate"), responses: { "201": resourceResponse("FX observation", "FxRate"), "400": errorResponse } }
    },
    "/v1/statements": {
      get: { security: auth, summary: "List external statements", responses: { "200": collectionResponse("Statements", "PortfolioStatement") } },
      post: { security: auth, summary: "Create idempotent external statement", requestBody: body("StatementCreate"), responses: { "201": resourceResponse("Statement", "PortfolioStatement"), "400": errorResponse, "409": errorResponse } }
    },
    "/v1/statements/{id}": { get: { security: auth, summary: "Get external statement", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": resourceResponse("Statement", "PortfolioStatement"), "404": errorResponse } } },
    "/v1/statements/{id}/reconcile": { post: { security: auth, summary: "Reconcile statement against dated ledger positions", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "201": resourceResponse("Reconciliation", "Reconciliation"), "400": errorResponse, "404": errorResponse } } },
    "/v1/reconciliations": { get: { security: auth, summary: "List reconciliation history", responses: { "200": collectionResponse("Reconciliations", "Reconciliation") } } },
    "/v1/reconciliations/{id}": { get: { security: auth, summary: "Get reconciliation result", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": resourceResponse("Reconciliation", "Reconciliation"), "404": errorResponse } } },
    "/v1/portfolio/current": { get: { security: auth, summary: "Current portfolio", responses: { "200": collectionResponse("Portfolio positions", "PortfolioPosition") } } },
    "/v1/portfolio/at/{date}": { get: { security: auth, summary: "Portfolio at date", parameters: [{ name: "date", in: "path", required: true, schema: { type: "string", format: "date" } }], responses: { "200": collectionResponse("Portfolio positions", "PortfolioPosition") } } },
    "/v1/portfolio/value/{date}": { get: { security: auth, summary: "Historically valued portfolio with price and FX provenance", parameters: [{ name: "date", in: "path", required: true, schema: { type: "string", format: "date" } }, { name: "source", in: "query", schema: { type: "string" } }], responses: { "200": collectionResponse("Valued positions or structured missing market data", "ValuedPosition") } } },
    "/v1/portfolio/analytics/{date}": {
      get: {
        security: auth,
        summary: "Point-in-time portfolio value bridge separating external flow from gain or loss",
        description: "Returns marketValue, openingValue, contributions, withdrawals, netExternalFlow, and gainLoss. Formula: gainLoss = marketValue - openingValue - netExternalFlow. Only contribution and withdrawal operations are external flows.",
        parameters: [
          { name: "date", in: "path", required: true, schema: { type: "string", format: "date" } },
          { name: "source", in: "query", schema: { type: "string" } }
        ],
        responses: { "200": resourceResponse("Portfolio analytics with provenance and completeness diagnostics", "PortfolioAnalytics"), "400": errorResponse }
      }
    },
    "/v1/portfolio/concentration/{date}": {
      get: {
        security: auth, summary: "Top-N asset concentration by base-currency market value",
        parameters: [
          { name: "date", in: "path", required: true, schema: { type: "string", format: "date" } },
          { name: "top", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 5 } },
          { name: "source", in: "query", schema: { type: "string" } }
        ],
        responses: { "200": resourceResponse("Concentration with whole-portfolio weights or incomplete diagnostics", "Concentration"), "400": errorResponse }
      }
    },
    "/v1/portfolio/evolution": {
      get: {
        security: auth,
        summary: "Bounded portfolio evolution and optional normalized benchmark comparison",
        description: "Samples are deterministic UTC period ends plus range boundaries. Weekly periods end Sunday. Series normalize to 100 at the first common complete sample and are not TWR, MWR, IRR, alpha, or advice.",
        parameters: [
          { name: "from", in: "query", required: true, schema: { type: "string", format: "date" } },
          { name: "to", in: "query", required: true, schema: { type: "string", format: "date" } },
          { name: "interval", in: "query", schema: { type: "string", enum: ["daily", "weekly", "monthly"], default: "monthly" } },
          { name: "source", in: "query", schema: { type: "string" } },
          { name: "benchmarkId", in: "query", schema: { type: "string" } }
        ],
        responses: { "200": resourceResponse("Portfolio evolution with optional benchmark index", "PortfolioEvolution"), "400": errorResponse, "404": errorResponse }
      }
    },
    "/v1/allocations/{by}": { get: { security: auth, summary: "Allocation grouping", parameters: [{ name: "by", in: "path", required: true, schema: { type: "string", enum: ["asset", "assetClass", "currency", "country", "market", "broker", "account"] } }], responses: { "200": collectionResponse("Allocations", "Allocation") } } },
    "/v1/allocations/{by}/value/{date}": { get: { security: auth, summary: "Base-currency allocation with market-data provenance diagnostics", parameters: [{ name: "by", in: "path", required: true, schema: { type: "string", enum: ["asset", "assetClass", "currency", "country", "market", "broker", "account"] } }, { name: "date", in: "path", required: true, schema: { type: "string", format: "date" } }, { name: "source", in: "query", schema: { type: "string" } }], responses: { "200": collectionResponse("Valued allocations with weights only when complete", "ValuedAllocation") } } },
    "/v1/daily-package/{date}": { get: { security: auth, summary: "Daily raw data package", parameters: [{ name: "date", in: "path", required: true, schema: { type: "string", format: "date" } }], responses: { "200": resourceResponse("Daily package", "DailyPackage") } } },
    "/v1/changes": {
      get: {
        security: auth,
        summary: "Changes since cursor",
        parameters: [{
          name: "cursor", in: "query", required: false,
          description: "Opaque cursor returned by the previous response. ISO timestamps are accepted by the current implementation.",
          schema: { type: "string" }
        }],
        responses: { "200": resourceResponse("Changes and next cursor", "ChangesResponse") }
      }
    },
    "/v1/pending-work": { get: { security: auth, summary: "Pending processing work", responses: { "200": resourceResponse("Pending work", "PendingWork") } } }
  }
};
