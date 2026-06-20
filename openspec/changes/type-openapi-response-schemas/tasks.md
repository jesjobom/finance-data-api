## 1. Response Inventory

- [x] 1.1 Inventory every public operation, success status, and runtime response type.
- [x] 1.2 Identify reusable resource, collection, calculated-result, and diagnostic components.

## 2. OpenAPI Components

- [x] 2.1 Add shared metadata, error-adjacent, completeness, and missing-data value schemas.
- [x] 2.2 Add persisted resource schemas for portfolios, accounts, assets, operations, news, market data, statements, reconciliations, and snapshots.
- [x] 2.3 Add calculated response schemas for positions, valuations, allocations, analytics, concentration, evolution, daily packages, changes, pending work, and virtual comparisons.

## 3. Route Response Typing

- [x] 3.1 Replace every empty single-resource success response with a component reference.
- [x] 3.2 Replace every empty collection success response with a typed array schema.
- [x] 3.3 Type nullable, replay, processing, and calculated response variants without overstating required fields.

## 4. Contract Validation And Documentation

- [x] 4.1 Add tests rejecting empty or missing successful response schemas.
- [x] 4.2 Add tests resolving every successful response component reference.
- [x] 4.3 Validate representative runtime responses against documented required fields and top-level types.
- [x] 4.4 Restore agent documentation stating that `/openapi.json` is authoritative for response shapes.

## 5. Validation And Delivery

- [x] 5.1 Run targeted OpenAPI and runtime contract tests.
- [x] 5.2 Run the full test suite, typecheck, lint, build, and OpenSpec strict validation.
- [x] 5.3 Review all public operations and confirm no successful response remains `{}`.
