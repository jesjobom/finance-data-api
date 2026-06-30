## ADDED Requirements

### Requirement: News story cluster API
The system SHALL document authenticated versioned endpoints or response
schemas that expose story clusters, primary news mention, additional mentions,
grouping provenance, and effective classification metadata.

#### Scenario: Retrieve clustered story
- **WHEN** a client retrieves a story cluster
- **THEN** the response includes the primary news item, bounded `alsoSeenIn` mention data, source count, grouping reasons, and effective classification status

#### Scenario: Preserve mention detail links
- **WHEN** a cluster response includes non-primary mentions
- **THEN** each mention includes stable news identity and enough source, title, URL, summary, and publication metadata for an agent to inspect the original item

### Requirement: Cluster-aware classification queue API
The system SHALL document unclassified-news queue responses as cluster-aware
entries while preserving news-item provenance for each mention.

#### Scenario: Retrieve unclassified clustered work
- **WHEN** an agent requests unclassified news work
- **THEN** the API returns story-cluster queue entries rather than duplicate item entries for each mention in the same cluster

#### Scenario: Indicate mention-derived classification
- **WHEN** a story cluster is effectively classified from a mention classification
- **THEN** API responses identify the classification source and do not present the cluster as unclassified

### Requirement: Duplicate grouping OpenAPI schemas
The checked-in OpenAPI document SHALL define reusable schemas for story
clusters, story mentions, grouping provenance, effective classification source,
conflict state, and new-evidence review indicators.

#### Scenario: Validate cluster contract
- **WHEN** story grouping routes or queue responses change
- **THEN** contract tests verify runtime responses and OpenAPI schemas remain aligned
