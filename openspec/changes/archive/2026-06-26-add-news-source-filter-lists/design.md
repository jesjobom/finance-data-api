## Context

The current news source registry stores adapter configuration and operational
policy, but every valid candidate from an enabled source is accepted unless it
fails structural validation such as timestamp or HTTP policy checks. Some
sources publish broad feeds where only a subset of categories or title patterns
are useful for Jarvis' finance workflow.

This change adds source-owned content filtering. It must remain deterministic,
auditable, and safe to expose through configuration because source
configuration is stored in the database and may be updated through API or seed
imports.

## Goals / Non-Goals

**Goals:**

- Let each source define whitelist and blacklist terms for title and category.
- Make whitelist precedence explicit and testable.
- Keep common matching readable through non-regex modes.
- Allow regex only as a validated, bounded escape hatch.
- Explain filter outcomes in run diagnostics without logging full raw payloads.

**Non-Goals:**

- Global filter rules shared across all sources.
- Filtering article body text, summaries, URLs, or classifier output.
- Creating a user-facing rule builder or free-form expression language.
- Replacing downstream classification, review, or processing-state workflows.

## Decisions

### Store filters in validated source configuration

Add optional `candidateFilters` to `NewsSourceConfig` with `whitelist` and
`blacklist` arrays. This keeps filters scoped to the same source configuration
that defines adapter behavior, and it avoids a new table until operators need
rule-level audit history or sharing.

Each rule contains:

- `value`: the term or regex pattern;
- `mode`: `contains`, `word`, `exact`, or `regex`;
- `target`: `title`, `category`, or `both`;
- `enabled`: optional, defaulting to true;
- `reason`: optional operator note.

`contains`, `word`, and `exact` cover the common cases without regex
complexity. Regex is supported for edge cases but must compile during source
validation and must be evaluated with bounded input size.

### Normalize text before matching

The collector compares lowercased and trimmed text. Accent folding should be
enabled by default unless a source proves it causes false positives. Category
values are treated as a list even when an adapter provides one string.

This makes source rules stable across publisher casing and minor formatting
differences.

### Evaluate filters after adapter normalization

Adapters continue to produce normalized candidates without knowing source
filter rules. The collection service evaluates filters after timestamp/category
normalization and before accepted item persistence and deduplication.

Decision order:

1. If any enabled whitelist rule matches, accept the candidate for normal
   persistence even when a blacklist rule also matches.
2. Otherwise, if any enabled blacklist rule matches, reject the candidate with
   a filter diagnostic.
3. Otherwise, accept the candidate.

This preserves adapter reuse and makes filter behavior consistent across RSS,
Guardian, and future adapters.

### Keep diagnostics bounded and explainable

Rejected candidates increment the existing rejected count and include a bounded
diagnostic entry with source ID, rule list, target, mode, rule value hash or
truncated value, and candidate identity where available. Accepted whitelist
matches may be counted or sampled in diagnostics to support dry-run review, but
they must not create noisy unbounded logs.

## Risks / Trade-offs

- [Regex can become expensive or confusing] -> Validate syntax at source write
  time, bound candidate input length, and prefer non-regex modes in docs and
  seeds.
- [A blacklist can silently drop useful stories] -> Whitelist precedence,
  reasons, diagnostics, and targeted tests make decisions reviewable.
- [Filters in config are less auditable than a rule table] -> Accept this for
  the first implementation because rules are source-local and small; migrate to
  a table later if rule ownership or history becomes important.
- [Category formats vary by adapter] -> Normalize categories to arrays and test
  RSS and API examples separately.

## Migration Plan

1. Add the optional config shape with validation defaults; existing sources
   remain unchanged and accept candidates as before.
2. Update API/OpenAPI and seed validation to round-trip filters.
3. Add collection filtering and diagnostics.
4. Backfill seed filters only after observing source noise; this change does
   not require immediate production rules.

## Open Questions

- Should accepted whitelist hits get a separate counter, or is bounded
  diagnostic sampling enough for the first release?
- Should accent folding be configurable per source if it creates false
  positives for non-English feeds?
