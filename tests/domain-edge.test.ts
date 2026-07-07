import { describe, expect, it } from "vitest";
import {
  canonicalOperationPayload,
  canonicalClassificationPayload,
  classificationPayloadHash,
  classificationTargetIdentity,
  newsCollectionTriggerSchema,
  newsClassificationCreateSchema,
  newsSourceCreateSchema,
  operationCreateSchema
} from "../src/domain.js";

function validClassification(overrides: Record<string, unknown> = {}) {
  return {
    classifierId: "macro-agent",
    classifierType: "agent",
    classifierVersion: "v1",
    externalRunId: "run-1",
    importance: "medium",
    scope: "mixed",
    horizon: "short_term",
    overallConfidence: 0.75,
    tags: ["rate-change"],
    countries: ["ca"],
    currencies: ["cad"],
    sectors: [{ taxonomy: "gics", code: "financials", label: "Financials" }],
    evidence: [{ key: "headline", sourceField: "title", explanation: "Headline names the rate decision." }],
    targets: [{
      targetType: "currency",
      targetKey: "cad",
      direction: "uncertain",
      magnitude: "unknown",
      confidence: 0.4,
      rationale: "Direction is not clear from the source alone.",
      evidenceKeys: ["headline"]
    }],
    ...overrides
  };
}

describe("domain edge cases", () => {
  it("normalizes classification slugs and ISO dimensions before persistence", () => {
    const parsed = newsClassificationCreateSchema.parse(validClassification({
      classifierId: "Macro-Agent",
      tags: ["Rate-Change"],
      countries: ["ca"],
      currencies: ["cad"],
      targets: [{
        targetType: "company",
        companyName: "Apple Inc.",
        market: "nasdaq",
        symbol: "aapl",
        direction: "mixed",
        magnitude: "low",
        confidence: 0.6,
        rationale: "Mixed exposure is plausible.",
        evidenceKeys: ["headline"]
      }]
    }));

    expect(parsed.classifierId).toBe("macro-agent");
    expect(parsed.tags).toEqual(["rate-change"]);
    expect(parsed.countries).toEqual(["CA"]);
    expect(parsed.currencies).toEqual(["CAD"]);
    expect(parsed.targets[0]).toMatchObject({ market: "NASDAQ", symbol: "AAPL" });
  });

  it("rejects duplicate classification dimensions and duplicate target identities", () => {
    expect(() => newsClassificationCreateSchema.parse(validClassification({ tags: ["macro", "macro"] }))).toThrow(/Duplicate tags/);
    expect(() => newsClassificationCreateSchema.parse(validClassification({ countries: ["CA", "ca"] }))).toThrow(/Duplicate countries/);
    expect(() => newsClassificationCreateSchema.parse(validClassification({
      targets: [
        { targetType: "currency", targetKey: "CAD", direction: "neutral", magnitude: "low", confidence: 0.5, rationale: "First", evidenceKeys: ["headline"] },
        { targetType: "currency", targetKey: "cad", direction: "mixed", magnitude: "medium", confidence: 0.6, rationale: "Duplicate", evidenceKeys: ["headline"] }
      ]
    }))).toThrow(/Duplicate target identity/);
  });

  it("rejects dangling evidence references and missing target identifiers", () => {
    expect(() => newsClassificationCreateSchema.parse(validClassification({
      targets: [{ targetType: "country", direction: "neutral", magnitude: "low", confidence: 0.5, rationale: "No target key", evidenceKeys: ["headline"] }]
    }))).toThrow(/Target type requires targetKey/);

    expect(() => newsClassificationCreateSchema.parse(validClassification({
      targets: [{ targetType: "investment", direction: "neutral", magnitude: "low", confidence: 0.5, rationale: "No investment", evidenceKeys: ["headline"] }]
    }))).toThrow(/Investment target requires investmentId/);

    expect(() => newsClassificationCreateSchema.parse(validClassification({
      targets: [{ targetType: "currency", targetKey: "CAD", direction: "neutral", magnitude: "low", confidence: 0.5, rationale: "Bad evidence", evidenceKeys: ["missing"] }]
    }))).toThrow(/Unknown evidence key/);
  });

  it("uses stable classification payload hashes independent of object key order", () => {
    const left = validClassification({ optionalUndefined: undefined });
    const right = {
      targets: left.targets,
      evidence: left.evidence,
      sectors: left.sectors,
      currencies: left.currencies,
      countries: left.countries,
      tags: left.tags,
      overallConfidence: left.overallConfidence,
      horizon: left.horizon,
      scope: left.scope,
      importance: left.importance,
      externalRunId: left.externalRunId,
      classifierVersion: left.classifierVersion,
      classifierType: left.classifierType,
      classifierId: left.classifierId
    };

    expect(canonicalClassificationPayload(left)).toBe(canonicalClassificationPayload(right));
    expect(classificationPayloadHash(left)).toBe(classificationPayloadHash(right));
  });

  it("keeps operation import identity independent from audit fields", () => {
    const parsed = operationCreateSchema.parse({
      investmentId: "inv_1",
      accountId: "account_default",
      type: "buy",
      effectiveDate: "2026-06-21",
      quantity: 1,
      currency: "usd",
      importSource: "broker",
      externalId: "trade-1"
    });

    expect(parsed.currency).toBe("USD");
    expect(canonicalOperationPayload(parsed)).toBe(canonicalOperationPayload({
      ...parsed,
      payloadHash: "server-generated",
      version: 99,
      createdAt: "2026-06-21T00:00:00.000Z",
      updatedAt: "2026-06-21T00:00:00.000Z",
      reviewedAt: "2026-06-21T00:00:00.000Z",
      reviewedBy: "reviewer",
      reviewNotes: "audit-only"
    }));
  });

  it("builds stable target identities for case-insensitive external targets", () => {
    expect(classificationTargetIdentity({ targetType: "currency", targetKey: "cad" })).toBe("currency:CAD");
    expect(classificationTargetIdentity({ targetType: "company", companyName: " Apple Inc. ", market: "NASDAQ", symbol: "AAPL" }))
      .toBe("company:apple inc.|NASDAQ|AAPL");
  });

  it("rejects invalid news source filter regexes and missing required secrets", () => {
    expect(() => newsSourceCreateSchema.parse({
      slug: "bad-regex",
      name: "Bad Regex",
      adapterType: "rss",
      endpoint: "https://news.example.com/feed.xml",
      config: { candidateFilters: { blacklist: [{ value: "[", mode: "regex" }] } }
    })).toThrow(/Invalid candidate filter regex/);

    expect(() => newsSourceCreateSchema.parse({
      slug: "guardian",
      name: "Guardian",
      adapterType: "guardian",
      endpoint: "https://content.guardianapis.com/search"
    })).toThrow(/Guardian source requires a secret reference/);
  });

  it("guards news collection trigger edge cases", () => {
    expect(() => newsCollectionTriggerSchema.parse({ mode: "selected" })).toThrow(/Selected mode requires sourceIds/);
    expect(() => newsCollectionTriggerSchema.parse({
      from: "2026-06-20T00:00:00.000Z",
      to: "2026-06-21T00:00:01.000Z"
    })).toThrow(/24 hours/);
    expect(() => newsCollectionTriggerSchema.parse({
      from: "2026-06-21T00:00:00.000Z",
      to: "2026-06-20T23:59:59.000Z"
    })).toThrow(/from must not be after to/);
  });
});
