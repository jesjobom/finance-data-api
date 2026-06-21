## Context

`news_items` intentionally stores publisher content, provenance, retrieval
metadata, factual asset links, and processing state without intelligence or
impact claims. Agents now need to enrich those records with judgments that are
useful for prioritization and filtering but are inherently model-dependent,
uncertain, revisable, and sometimes contradictory.

The service already has stable investment identities, watched assets, bearer
authentication, processing audit patterns, PostgreSQL persistence, and a
checked-in OpenAPI contract. The classification model must work when an affected
company is not yet registered as an investment and must preserve multiple
classifiers or classifier versions without selecting an unsupported consensus.

## Goals / Non-Goals

**Goals:**

- Persist structured classifications separately from factual news.
- Let authenticated agents submit classifications through a versioned API.
- Preserve classifier identity, implementation/model version, external run
  identity, confidence, evidence, and immutable history.
- Support importance, horizon, scope, countries, currencies, sectors, tags,
  companies, investments, direction, and magnitude.
- Make replay, correction, review, pending work, and filtered retrieval
  deterministic and auditable.
- Support unresolved company targets that can later be linked to stable
  investments without rewriting classification history.

**Non-Goals:**

- Automatically invoking an LLM or choosing the classifier prompt/model.
- Treating inferred impact as publisher fact.
- Producing trading recommendations, portfolio actions, thesis checks,
  sentiment scores, price targets, or expected returns.
- Merging multiple classifiers into one canonical truth or consensus score.
- Automatically marking a news item processed when it is classified.
- Defining a proprietary sector ontology in this release.

## Decisions

### Store classifications as separate immutable records

Add `news_classifications` rather than columns on `news_items`. A classification
references one news item and records:

- classifier identity and type;
- classifier/model/rule version;
- external run ID and canonical payload hash;
- importance, horizon, scope, overall confidence, tags, countries, currencies,
  and sectors;
- optional predecessor through `supersedes_classification_id`;
- creation and audit timestamps.

Once created, inferred content is immutable. Corrections create a successor.
This preserves the factual boundary and makes historical agent behavior
reproducible. Updating one mutable “current classification” row was rejected
because it would erase model/version disagreements and correction history.

### Use source-scoped idempotency for agent submissions

The idempotency key is `(news_id, classifier_id, external_run_id)`. An identical
canonical payload returns the existing classification. Reusing the tuple with
different content returns a conflict.

`classifier_id` is a stable logical agent or rule identifier, while
`classifier_version` identifies the model, prompt, ruleset, or deployment
version. The API does not trust display names as idempotency identity.

### Separate coverage dimensions from directional targets

Top-level normalized dimensions answer broad discovery questions:

- `countries`: ISO 3166-1 alpha-2;
- `currencies`: ISO 4217 alpha-3;
- `sectors`: `{taxonomy, code, label}` with stable normalized code;
- `tags`: controlled-by-client lowercase slugs;
- `scope`: global, country, sector, company, or mixed;
- `horizon`: immediate, short_term, medium_term, or long_term;
- `importance`: low, medium, high, or critical.

Directional claims live in `news_classification_targets`. Every target has a
type, normalized identity, direction, magnitude, confidence, and rationale.
Supported types are country, currency, sector, company, and investment.

This avoids pretending that every mentioned country or currency is impacted in
the same direction. Storing only arrays was considered but cannot represent
mixed effects or target-specific confidence.

Bounded top-level dimensions and evidence are stored as JSONB on the immutable
classification because they are always read with that record and are replaced
only through supersession. Directional targets use a relational table because
they require target-specific indexes, investment foreign keys, resolution
records, and combined filters.

### Distinguish known investments from unresolved companies

An investment target references `investments.id`. A company target can carry a
normalized name and optional market/symbol when no stable investment exists.
The target may later receive a separate resolution link to an investment;
resolution does not rewrite the original classifier payload.

`relatedInvestmentIds` on the news item remains a factual/manual association.
Classification targets represent inferred impact and never automatically
modify that field.

### Use bounded confidence and categorical magnitude

Confidence is a finite number from 0 through 1. Direction is positive,
negative, mixed, neutral, or uncertain. Magnitude is low, medium, high, or
unknown.

Importance answers how much attention the story deserves overall; target
magnitude answers how large the estimated effect is for one target. They are
not interchangeable. Numerical expected return or price impact was rejected
because the available evidence does not support deterministic precision.

### Preserve evidence and rationale without claiming verification

Classifications can include bounded evidence records with source field
(`title`, `summary`, or `body`), optional excerpt, and explanation. Targets can
reference evidence IDs. Evidence records explain the classifier output but do
not certify that a claim is true.

Request limits bound evidence count, excerpt length, rationale length, target
count, tags, and taxonomy dimensions to keep API and storage costs predictable.

### Keep review as append-only audit

Add `news_classification_reviews` with reviewer identity, decision
(`approved`, `rejected`, or `needs_revision`), notes, and timestamp. Reviews do
not mutate classification content. The effective review state is the latest
review using timestamp and stable ID as tie-breakers.

Approval means the classification passed the configured review process; it
does not convert inference into fact.

### Derive current and superseded views deterministically

A classification is superseded when a valid successor references it. Current
views return non-superseded classifications, independently per classifier. The
service does not choose one classifier over another.

Supersession is valid only for the same news item and classifier identity and
cannot create a cycle. A predecessor can have at most one direct accepted
successor for that classifier lineage.

### Add classification work queues without coupling processing state

Expose bounded queries for:

- news with no current classification;
- current classifications without review;
- classifications needing revision.

News `processedAt` remains independent. A news item can be processed but
unclassified, or classified but not processed. Pending-work output reports the
states separately.

### Keep agent orchestration outside the API

This change provides persistence, work discovery, and write/review APIs. A
future OpenClaw job or dedicated classifier agent can consume the unclassified
queue and submit results. Keeping orchestration separate permits model changes
without coupling them to the deterministic data service.

## Risks / Trade-offs

- [Agents may overstate uncertain impact] → Require confidence, permit
  `uncertain`, preserve evidence and classifier version, and keep review state.
- [Different agents may disagree] → Preserve parallel current classifications
  per classifier and do not synthesize consensus automatically.
- [Free-form tags and sectors may drift] → Normalize tags and require taxonomy
  plus stable sector code; add managed vocabularies later if needed.
- [Company targets may not resolve to investments] → Store unresolved company
  identity and expose resolution status separately.
- [Large classification payloads can grow storage quickly] → Enforce strict
  counts and text-size limits and index query dimensions selectively.
- [Supersession graphs can become inconsistent] → Validate same-news,
  same-classifier, single-successor, and acyclic lineage transactionally.
- [Approval can be mistaken for factual truth] → Document review as workflow
  acceptance only and retain inference/provenance fields in every response.
- [Classification queue scans can become expensive] → Add current-lineage,
  review, news-date, and target-dimension indexes and bounded pagination.

## Migration Plan

1. Add additive classification, target, evidence, review, and resolution tables
   with uniqueness, confidence, lineage, and lookup indexes.
2. Add domain types, canonical hashing, validation limits, in-memory behavior,
   and PostgreSQL persistence.
3. Add create, get, history, review, filtered list, and queue endpoints.
4. Extend pending work without changing existing news processing semantics.
5. Add OpenAPI components, contract tests, and agent usage examples.
6. Validate with fixture classifications from multiple classifier versions,
   conflicting judgments, replay, supersession, review, and unresolved targets.
7. Introduce classifier-agent orchestration only in a separate operational
   change after the API contract is accepted.

Rollback removes classification routes and queue fields while retaining the
additive tables for audit. No factual news or investment records need to change.

## Open Questions

- Select the initial default sector taxonomy for the first classifier agent;
  the storage contract supports a named taxonomy without mandating one.
- Decide whether reviewer authorization needs distinct bearer-token roles or
  remains actor-attributed under the current shared API token in the first
  implementation.
- Decide initial pagination limits after measuring classification target volume.
