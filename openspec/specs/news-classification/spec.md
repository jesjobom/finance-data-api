# news-classification Specification

## Purpose
TBD - created by archiving change add-news-classification. Update Purpose after archive.
## Requirements
### Requirement: Separate inferred classification records
The system SHALL store inferred news classifications separately from factual
news items and SHALL preserve classifier identity, classifier type, classifier
version, external run identity, canonical payload hash, overall confidence,
importance, scope, horizon, classification dimensions, creation time, and
optional supersession lineage.

#### Scenario: Create an agent classification
- **WHEN** an authenticated agent submits a valid classification for an existing news item
- **THEN** the system stores a new immutable classification linked to the news item without modifying publisher-provided news fields

#### Scenario: Preserve factual news boundary
- **WHEN** a classification estimates importance or impact
- **THEN** the system exposes that content as classifier-generated inference and does not copy it into factual `news_items` fields

### Requirement: Classification dimensions
The system SHALL support overall importance, impact horizon, economic scope,
normalized tags, ISO country codes, ISO currency codes, and sectors identified
by taxonomy and stable code.

#### Scenario: Classify a global monetary story
- **WHEN** an agent submits a high-importance global classification affecting valid countries, currencies, sectors, and tags
- **THEN** the system normalizes and stores every dimension in a queryable form

#### Scenario: Reject invalid dimension values
- **WHEN** a classification contains an unknown enum, malformed country or currency code, invalid confidence, duplicate dimension, or out-of-bounds collection
- **THEN** the system rejects the complete request with structured validation details

### Requirement: Structured impact targets
The system SHALL store zero or more target-specific impact estimates with target
type and identity, direction, magnitude, confidence, rationale, and evidence
references.

#### Scenario: Record different effects by target
- **WHEN** one classification estimates positive impact for one currency and negative impact for one sector
- **THEN** the system preserves each target with its independent direction, magnitude, confidence, and rationale

#### Scenario: Record uncertain impact
- **WHEN** an agent cannot determine direction or magnitude reliably
- **THEN** it can submit `uncertain` direction or `unknown` magnitude with bounded confidence rather than inventing precision

#### Scenario: Reject duplicate target identity
- **WHEN** one classification repeats the same normalized target type and identity
- **THEN** the system rejects the duplicate target instead of storing ambiguous parallel estimates

### Requirement: Investment and company target distinction
The system SHALL distinguish stable investment targets from unresolved company
targets and SHALL keep both separate from factual news-to-investment links.

#### Scenario: Target a known investment
- **WHEN** an impact target references an existing investment identifier
- **THEN** the system validates the investment and stores the inferred impact without changing `relatedInvestmentIds`

#### Scenario: Target an unresolved company
- **WHEN** an affected company has no registered investment
- **THEN** the system stores its normalized name and optional market and symbol with unresolved status

#### Scenario: Resolve a company later
- **WHEN** an authorized client links an unresolved company target to a known investment
- **THEN** the system records the resolution audit separately and preserves the original classifier payload

### Requirement: Classification evidence
The system SHALL allow bounded evidence entries that identify a news source
field, optional excerpt, and explanation, and SHALL allow impact targets to
reference evidence in the same classification.

#### Scenario: Submit target evidence
- **WHEN** a target references valid evidence entries from its classification
- **THEN** the system stores the references and returns them with classification provenance

#### Scenario: Reject foreign evidence reference
- **WHEN** a target references missing evidence or evidence belonging to another classification
- **THEN** the system rejects the classification atomically

### Requirement: Idempotent agent submission
The system SHALL treat news ID, classifier ID, and external run ID as the
classification idempotency scope and SHALL compare canonical payload hashes.

#### Scenario: Replay identical classification
- **WHEN** an agent repeats the same canonical payload with the same news, classifier, and external run identity
- **THEN** the system returns the existing classification and reports that no new record was created

#### Scenario: Reuse run identity with different inference
- **WHEN** an agent reuses the same idempotency scope with a different canonical payload
- **THEN** the system returns a conflict and preserves the original classification

#### Scenario: Reuse external run ID for another classifier
- **WHEN** a different classifier uses the same external run ID
- **THEN** the system treats it as a distinct idempotency scope

### Requirement: Immutable supersession history
The system SHALL correct classifications by creating a successor that references
the prior classification and SHALL derive current records without mutating
historical inference.

#### Scenario: Supersede a classification
- **WHEN** the same classifier submits a valid successor for the same news item
- **THEN** the system stores the successor and excludes the predecessor from current-only queries while retaining it in history

#### Scenario: Reject invalid supersession
- **WHEN** a successor references another news item, another classifier, an already superseded predecessor, or creates a lineage cycle
- **THEN** the system rejects the complete submission

#### Scenario: Preserve parallel classifiers
- **WHEN** two classifiers produce classifications for the same news item
- **THEN** current queries can return both and the system does not choose an automatic consensus

### Requirement: Classification review audit
The system SHALL store append-only classification reviews with reviewer,
decision, optional notes, timestamp, and stable identity and SHALL derive the
effective review state deterministically.

#### Scenario: Approve a classification
- **WHEN** an authorized reviewer approves a classification
- **THEN** the system appends an approval review without changing classification content

#### Scenario: Request revision
- **WHEN** a reviewer records `needs_revision`
- **THEN** the classification appears in the revision work queue until superseded or reviewed again

#### Scenario: Preserve review history
- **WHEN** a later review changes the effective decision
- **THEN** previous reviews remain retrievable in stable chronological order

### Requirement: Filtered classification queries
The system SHALL provide bounded, deterministically ordered classification
queries by news, classifier, importance, current/history selection, review
status, country, currency, sector, target investment or company, direction,
minimum confidence, and news publication interval.

#### Scenario: Query high-impact currency news
- **WHEN** an agent filters current classifications by high-or-critical importance, currency, direction, and publication interval
- **THEN** the system returns matching classifications in documented stable order with bounded pagination

#### Scenario: Query one news history
- **WHEN** an agent requests all classifications and reviews for one news item
- **THEN** the system returns parallel classifier lineages and superseded records without collapsing disagreement

### Requirement: Classification work queues
The system SHALL expose bounded work queues for unclassified news, unreviewed
current classifications, and classifications whose effective review decision
requires revision.

#### Scenario: List unclassified news
- **WHEN** an agent requests unclassified news
- **THEN** the system returns news with no current classification in stable publication order

#### Scenario: Keep processing state independent
- **WHEN** news is marked processed but has no classification
- **THEN** it remains eligible for the unclassified queue

#### Scenario: Keep classification state independent
- **WHEN** a classification is created for unprocessed news
- **THEN** the news remains in unprocessed-news queries until separately processed

### Requirement: No investment recommendation semantics
The system SHALL treat classifications as uncertain analytical metadata and
SHALL NOT derive recommendations, trades, price targets, expected returns,
portfolio actions, or thesis status from them.

#### Scenario: Submit prohibited recommendation field
- **WHEN** a client attempts to include a trade recommendation, target price, or expected return in a classification request
- **THEN** strict validation rejects the unsupported field

