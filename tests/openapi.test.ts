import { describe, expect, it } from "vitest";
import { openApiDocument } from "../src/openapi.js";
import { createInvestment, testApp } from "./helpers.js";

const httpMethods = ["get", "post", "put", "patch", "delete"] as const;

function responseSchemas() {
  const found: Array<{ path: string; method: string; status: string; schema: any }> = [];
  for (const [path, pathItem] of Object.entries(openApiDocument.paths)) {
    for (const method of httpMethods) {
      const operation = pathItem?.[method];
      if (!operation || "$ref" in operation) continue;
      for (const [status, response] of Object.entries(operation.responses)) {
        if (!/^2\d\d$/.test(status) || "$ref" in response) continue;
        found.push({
          path, method, status,
          schema: response.content?.["application/json"]?.schema
        });
      }
    }
  }
  return found;
}

function referencedComponents(value: unknown, refs = new Set<string>()): Set<string> {
  if (!value || typeof value !== "object") return refs;
  if ("$ref" in value && typeof (value as any).$ref === "string") {
    const match = (value as any).$ref.match(/^#\/components\/schemas\/(.+)$/);
    if (match) refs.add(match[1]);
  }
  for (const nested of Object.values(value)) referencedComponents(nested, refs);
  return refs;
}

function requiredFields(schemaName: string, seen = new Set<string>()): string[] {
  if (seen.has(schemaName)) return [];
  seen.add(schemaName);
  const schema = openApiDocument.components?.schemas?.[schemaName];
  if (!schema || "$ref" in schema) return [];
  const own = schema.required ?? [];
  const inherited = (schema.allOf ?? []).flatMap((part) => {
    if ("$ref" in part) return requiredFields(part.$ref.split("/").at(-1)!, seen);
    return part.required ?? [];
  });
  return [...new Set([...own, ...inherited])];
}

describe("openapi route coverage", () => {
  it("documents every implemented public route", () => {
    const expectedPaths = [
      "/health",
      "/openapi.json",
      "/v1/investments",
      "/v1/investments/{id}",
      "/v1/investments/{id}/deactivate",
      "/v1/assets",
      "/v1/assets/{id}",
      "/v1/portfolios/{id}",
      "/v1/accounts",
      "/v1/accounts/{id}",
      "/v1/opening-positions",
      "/v1/operations",
      "/v1/operations/{id}",
      "/v1/operations/{id}/revisions",
      "/v1/operations/{id}/review",
      "/v1/news",
      "/v1/news/{id}",
      "/v1/news/{id}/process",
      "/v1/watched-assets",
      "/v1/virtual-portfolios",
      "/v1/virtual-portfolios/{portfolioId}/positions",
      "/v1/virtual-portfolios/{portfolioId}/compare",
      "/v1/benchmarks",
      "/v1/benchmark-observations",
      "/v1/snapshots",
      "/v1/snapshots/latest",
      "/v1/prices",
      "/v1/fx-rates",
      "/v1/statements",
      "/v1/statements/{id}",
      "/v1/statements/{id}/reconcile",
      "/v1/reconciliations",
      "/v1/reconciliations/{id}",
      "/v1/portfolio/current",
      "/v1/portfolio/at/{date}",
      "/v1/portfolio/value/{date}",
      "/v1/portfolio/analytics/{date}",
      "/v1/portfolio/concentration/{date}",
      "/v1/portfolio/evolution",
      "/v1/allocations/{by}",
      "/v1/allocations/{by}/value/{date}",
      "/v1/daily-package/{date}",
      "/v1/changes",
      "/v1/pending-work"
    ];

    expect(Object.keys(openApiDocument.paths).sort()).toEqual(expectedPaths.sort());
  });

  it("documents the changes cursor parameter and legacy asset broker field", () => {
    const changes = openApiDocument.paths["/v1/changes"]?.get;
    expect(changes && "parameters" in changes ? changes.parameters : undefined).toContainEqual(
      expect.objectContaining({ name: "cursor", in: "query" })
    );

    const investment = openApiDocument.components?.schemas?.InvestmentCreate;
    expect(investment && "properties" in investment ? investment.properties?.broker : undefined).toMatchObject({
      deprecated: true
    });
  });

  it("defines a non-empty JSON schema for every successful response", () => {
    const schemas = responseSchemas();
    expect(schemas.length).toBeGreaterThan(0);
    for (const entry of schemas) {
      expect(entry.schema, `${entry.method.toUpperCase()} ${entry.path} ${entry.status}`).toBeDefined();
      expect(Object.keys(entry.schema ?? {}), `${entry.method.toUpperCase()} ${entry.path} ${entry.status}`).not.toHaveLength(0);
    }
  });

  it("resolves every component reference used by successful responses", () => {
    const declared = new Set(Object.keys(openApiDocument.components?.schemas ?? {}));
    for (const entry of responseSchemas()) {
      for (const component of referencedComponents(entry.schema)) {
        expect(declared.has(component), `${entry.method.toUpperCase()} ${entry.path} references ${component}`).toBe(true);
      }
    }
    for (const [schemaName, schema] of Object.entries(openApiDocument.components?.schemas ?? {})) {
      for (const component of referencedComponents(schema)) {
        expect(declared.has(component), `${schemaName} references ${component}`).toBe(true);
      }
    }
  });

  it("matches representative runtime responses to documented required fields", async () => {
    const ctx = testApp();
    const investment = await createInvestment(ctx);
    const samples = [
      { schema: "Health", value: (await ctx.app.inject({ method: "GET", url: "/health" })).json() },
      { schema: "Investment", value: investment },
      { schema: "ChangesResponse", value: (await ctx.app.inject({ method: "GET", url: "/v1/changes", headers: ctx.auth })).json() },
      { schema: "PendingWork", value: (await ctx.app.inject({ method: "GET", url: "/v1/pending-work", headers: ctx.auth })).json() }
    ];
    for (const sample of samples) {
      expect(sample.value).toEqual(expect.any(Object));
      for (const field of requiredFields(sample.schema)) {
        expect(sample.value, `${sample.schema}.${field}`).toHaveProperty(field);
      }
    }
  });
});
