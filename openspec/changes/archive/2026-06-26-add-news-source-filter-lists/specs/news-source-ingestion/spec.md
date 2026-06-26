## ADDED Requirements

### Requirement: Per-source candidate filter lists
The system SHALL allow each news source to define optional candidate whitelist
and blacklist rules that match normalized candidate title and category values
before the candidate is persisted.

#### Scenario: Accept candidate with no matching filters
- **WHEN** a source has candidate filters configured and a normalized candidate matches no enabled whitelist or blacklist rule
- **THEN** the collector accepts the candidate for normal validation, deduplication, and persistence

#### Scenario: Reject candidate matching blacklist
- **WHEN** a normalized candidate title or category matches an enabled blacklist rule and no enabled whitelist rule matches
- **THEN** the collector rejects the candidate, increments the rejected count, and records a bounded filter diagnostic

#### Scenario: Whitelist overrides blacklist
- **WHEN** a normalized candidate title or category matches both an enabled whitelist rule and an enabled blacklist rule
- **THEN** the collector accepts the candidate for normal validation, deduplication, and persistence

#### Scenario: Disabled filter rule is ignored
- **WHEN** a normalized candidate matches only disabled filter rules
- **THEN** the collector treats those rules as absent and evaluates the candidate against the remaining enabled rules

### Requirement: Safe filter rule matching modes
The system SHALL support source filter rules using `contains`, `word`, `exact`,
and `regex` match modes against `title`, `category`, or `both` targets, and
SHALL validate regex syntax before saving source configuration.

#### Scenario: Match title by contained term
- **WHEN** a candidate title contains a configured `contains` rule value after text normalization
- **THEN** the rule matches the candidate

#### Scenario: Match category by exact value
- **WHEN** a candidate has a category equal to a configured `exact` rule value after text normalization
- **THEN** the rule matches the candidate

#### Scenario: Reject invalid regex rule
- **WHEN** a client creates, updates, or seeds a source with a regex filter rule that cannot compile
- **THEN** the system rejects the source configuration with a structured validation error

#### Scenario: Bound regex evaluation
- **WHEN** a regex filter rule is evaluated against a candidate
- **THEN** the system evaluates it only against bounded normalized title and category strings and does not expose unbounded raw source content to the matcher

### Requirement: Auditable filter decisions
The system SHALL expose enough collection diagnostics to explain candidate
filter decisions without storing unrestricted candidate payloads or source
response bodies in diagnostics.

#### Scenario: Inspect filtered collection run
- **WHEN** an agent retrieves a collection run where candidates were rejected by source filters
- **THEN** the run diagnostics identify the filter decision, source, matched list, rule mode, target, and bounded candidate identity

#### Scenario: Preserve source filter configuration through APIs
- **WHEN** an authenticated agent creates, updates, retrieves, or lists a news source with candidate filters
- **THEN** the API round-trips the non-secret filter configuration and documents the schema in the checked-in OpenAPI contract
