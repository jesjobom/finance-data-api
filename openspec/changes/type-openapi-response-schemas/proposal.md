## Why

The checked-in OpenAPI document describes routes and requests but leaves most
successful response schemas as `{}`. Agents therefore cannot validate or safely
consume responses from the contract that the service advertises.

## What Changes

- Define reusable OpenAPI components for persisted resources, calculated
  portfolio results, analytics, processing state, and collection envelopes.
- Replace every empty successful-response schema with an explicit schema or
  component reference.
- Represent nullable, optional, partial, and unavailable result states without
  claiming fields are always present.
- Add contract tests that fail when a public operation has an empty or missing
  successful response schema or references an unknown component.
- Update agent documentation so `/openapi.json` can again be treated as the
  source of truth for both request and response shapes.
- Do not change runtime endpoint behavior or persisted data.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `api-contract`: Require explicit, reusable, validated schemas for every
  successful public API response.

## Impact

- Primarily changes `src/openapi.ts`, OpenAPI contract tests, and agent
  documentation.
- May expose mismatches between documented and runtime response shapes that must
  be corrected in the contract without changing runtime compatibility.
- Adds no runtime dependency and no database migration.
