## Context

MVP1 models an investment as both an asset and, optionally, its broker. Operations reference that record directly and simple buy/sell arithmetic is the source of position truth. This works for one custody location and complete transaction history, but it cannot represent the same asset at multiple brokers, transfer cost basis safely, establish a trustworthy opening point, or value positions historically.

The finance agent needs deterministic accounting facts rather than advice. Supplied statements, prices, and exchange rates must remain attributable to their sources, and every calculated quantity or value must be reproducible.

## Goals / Non-Goals

**Goals:**

- Represent assets independently from brokerage or custody accounts.
- Establish an explicit opening state and history reliability boundary.
- Preserve quantity and cost basis through transfers and basic corporate actions.
- Make operation imports idempotent and factual corrections auditable.
- Store sourced historical prices and exchange rates.
- Reconcile calculated positions with a dated external statement.
- Return original-currency and base-currency valuation with provenance.

**Non-Goals:**

- Direct integration with brokerages or market-data vendors.
- Automatic symbol-master resolution across markets.
- Tax-lot accounting, jurisdiction-specific tax calculation, or tax advice.
- Automatic interpretation of arbitrary corporate-action documents.
- Time-weighted return, money-weighted return, benchmark analytics, or recommendation logic.
- Automatic correction of discrepancies found during reconciliation.

## Decisions

1. Separate asset identity from custody.
   - Introduce an asset identity keyed by normalized `market + symbol`, with optional ISIN, while brokerage accounts identify where positions are held.
   - Operations reference both asset and account when custody matters.
   - Existing investment identifiers remain accepted through a compatibility mapping during migration.
   - Alternative: keep one investment per broker. Rejected because transfers would appear as unrelated disposal/acquisition events and duplicate the same economic asset.

2. Add an explicit portfolio configuration and opening state.
   - Store portfolio base currency and `reliableFrom`.
   - Store opening positions and cash balances effective on `reliableFrom`, including quantity, original currency, and supplied total cost where known.
   - Calculations before `reliableFrom` are rejected as unreliable rather than silently inferred.
   - Alternative: synthesize historical buys. Rejected because invented dates and prices create false history and false performance.

3. Model transfers as one logical event with balanced custody legs.
   - A transfer contains source and destination accounts, asset, effective date, quantity, and transferred cost basis.
   - It reduces source custody and increases destination custody without changing portfolio-wide quantity, realized gain, or total cost basis.
   - Alternative: independent withdrawal and contribution operations. Rejected because partial failures and duplicate imports can change portfolio-wide holdings.

4. Model corporate actions with explicit accounting inputs.
   - Split and reverse-split events use a positive ratio and preserve total cost basis while changing quantity and unit cost.
   - Bonus events add quantity and require the supplied cost-basis treatment; the service does not assume all bonuses have zero cost.
   - Events may reference a destination asset when an action changes the security identity.
   - Alternative: encode all actions as zero-price buys or sells. Rejected because that distorts cash flow, gains, and audit meaning.

5. Use append-only revision history for operation corrections.
   - The current operation row carries `createdAt` and `updatedAt`.
   - A factual update requires a non-empty revision reason and writes an immutable before/after revision record with actor and timestamp in the same transaction.
   - Review or processing metadata alone does not create a factual revision.
   - Alternative: keep only the latest row and reason. Rejected because it cannot prove what changed.

6. Scope import identity to source and brokerage account.
   - The unique key is `(importSource, brokerageAccountId, externalId)`.
   - Replaying the same normalized payload returns the existing operation without a second write.
   - Reusing the key with different factual content returns a conflict and leaves the original unchanged.
   - Alternative: make `externalId` globally unique. Rejected because different institutions can issue the same identifier.

7. Store market observations rather than a mutable current quote.
   - Asset prices contain asset, effective timestamp/date, value, quote currency, source, and ingestion timestamps.
   - FX rates contain base currency, quote currency, effective timestamp/date, rate, source, and ingestion timestamps.
   - Multiple sources can coexist. Queries apply an explicit source or a documented deterministic source-selection policy and return the selected observation IDs.
   - Alternative: overwrite the latest quote. Rejected because historical valuation would not be reproducible.

8. Convert currency at query time with full provenance.
   - Monetary facts remain in their original currencies.
   - Valuation responses include original amount, base-currency amount, price observation, FX observation, and effective dates.
   - Direct rates are preferred; inverse rates may be derived and labeled. Multi-hop conversion is excluded initially unless explicitly configured later.
   - Changing portfolio base currency does not rewrite operations or market observations.

9. Persist external statements and reconciliation results.
   - A reconciliation has account, statement date, source, and statement lines identified by stable asset identity or an explicit mapping.
   - The comparison calculates quantity and, when supplied, cost/value differences using the ledger state as of the statement date.
   - Results are snapshots of the comparison inputs and status; they do not mutate ledger records.
   - Alternative: compare transient request data only. Rejected because discrepancies need to be repeatable and auditable.

## Risks / Trade-offs

- [Separating assets from investments affects most persistence and query paths] → Use additive tables, compatibility views/mapping, and staged endpoint migration.
- [Opening cost basis may be unknown] → Allow an explicit unknown cost state and prevent fabricated gain/performance values.
- [Corporate-action accounting varies by issuer and jurisdiction] → Require explicit ratios and cost treatment; do not infer tax rules.
- [Price or FX data may be missing for a requested date] → Return structured missing-market-data diagnostics instead of silently using current values.
- [Multiple observations can make valuation ambiguous] → Require source selection or apply and expose a stable documented selection rule.
- [Reconciliation symbol mapping can match the wrong asset] → Prefer asset IDs or normalized market/symbol and preserve unresolved statement lines.
- [Idempotency comparison can be sensitive to formatting] → Hash a canonical normalized factual payload, excluding server-managed audit fields.

## Migration Plan

1. Add portfolio, asset, brokerage-account, opening-state, transfer, corporate-action, operation-revision, import-identity, price, FX, statement, and reconciliation tables without removing MVP1 columns.
2. Backfill one default portfolio and brokerage account. Derive normalized assets from existing investments and flag collisions for manual resolution.
3. Link existing operations to the backfilled asset/account records and mark them as legacy imports without an external ID.
4. Deploy dual-read compatibility and update portfolio calculations to use the normalized model.
5. Add the new write and query endpoints, then update OpenAPI and agent usage documentation.
6. Validate migrated current positions against pre-migration results and add fixture-based reconciliation checks.
7. Remove legacy-only paths in a later explicitly breaking change after clients migrate.

Rollback before legacy column removal consists of disabling new endpoints and returning calculations to the existing investment/operation paths. New records must not be destructively down-migrated; rollback preserves them for a corrected forward migration.

## Decisions Resolved During Implementation

- The first cost-basis method is average cost; FIFO and tax-lot accounting remain out of scope.
- `reliableFrom` is portfolio-wide in this MVP.
- An explicit market-data source is preferred. Without one, selection uses the latest effective observation followed by source and observation ID as stable tie-breakers.
- Reconciliation preserves the statement's reported value and also calculates an API value at the statement date when price and FX inputs are available.
