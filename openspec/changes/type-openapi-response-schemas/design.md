## Context

`jsonResponse()` currently emits `schema: {}` for nearly every successful
response. Runtime response types already exist as TypeScript domain/store types,
but there is no automatic schema generation and adding a new dependency solely
for this repair would introduce migration and drift risk.

## Goals / Non-Goals

**Goals:**

- Explicitly type every successful JSON response.
- Reuse canonical components across CRUD and list routes.
- Cover partial analytics and missing-data states honestly.
- Add mechanical tests preventing regression to empty schemas.

**Non-Goals:**

- Runtime response serialization changes.
- Full code generation from OpenAPI or OpenAPI generation from TypeScript.
- A new schema-generation dependency.
- Exhaustive prose descriptions for every property in this change.

## Decisions

### Define components manually from runtime types

Create component schemas alongside existing request schemas and use helpers for
single resources, arrays, nullable resources, and specialized calculated
results. This is lower risk than introducing generation tooling during a
contract repair.

### Require meaningful structure, not merely non-empty objects

Resource components define stable IDs, timestamps, factual fields, and nested
records. Dynamic diagnostic details may use `additionalProperties`, but top-level
responses and primary resource shapes remain explicit.

### Model optionality from runtime behavior

Fields omitted by JSON serialization remain optional. Analytics completeness,
valuation availability, reconciliation variants, and latest-snapshot `null` are
represented without forcing fields that are absent at runtime.

### Add structural contract tests

Tests traverse all methods and 2xx responses, reject `{}`, resolve `$ref`
targets, and verify representative required fields. Existing route coverage
continues to ensure no public route is omitted.

## Risks / Trade-offs

- [Manual schemas can drift] → Contract tests plus representative runtime
  response validation reduce drift; generation tooling can be evaluated later.
- [Complex result schemas become verbose] → Reuse nested components and keep
  diagnostics extensible.
- [Overstated required fields reject valid partial responses] → Require only
  fields present in every runtime variant and keep conditional fields optional.

## Migration Plan

This is a contract-only additive deployment. Publish the updated OpenAPI
document with the existing runtime. Rollback restores the prior document and
tests; no data migration or client runtime change is required.
