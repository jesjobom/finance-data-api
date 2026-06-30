## ADDED Requirements

### Requirement: Story-level classification
The system SHALL support classifications whose effective subject is a story
cluster and whose evidence may reference one or more linked news mentions.

#### Scenario: Classify story using multiple mentions
- **WHEN** an agent classifies a story cluster with multiple mentions
- **THEN** the classification can cite evidence from the primary mention and any non-primary mention in the cluster

#### Scenario: Preserve mention evidence identity
- **WHEN** classification evidence references a field from a non-primary mention
- **THEN** the system stores the referenced news item identity with the evidence so the source remains auditable

### Requirement: Effective classification from existing mentions
The system SHALL derive an effective story classification from a current
classification on any linked mention when the story cluster has no direct
cluster classification.

#### Scenario: Non-primary mention already classified
- **WHEN** a story cluster has no direct cluster classification but one non-primary mention has a current classification
- **THEN** the story cluster is treated as effectively classified and exposes that mention as the classification source

#### Scenario: Conflicting mention classifications
- **WHEN** multiple mentions in one story cluster have current classifications that materially disagree
- **THEN** the system marks the cluster as having conflicting classifications instead of choosing an unreported winner

## MODIFIED Requirements

### Requirement: Classification work queues
The system SHALL expose bounded work queues for unclassified story clusters,
unreviewed current classifications, and classifications whose effective review
decision requires revision.

#### Scenario: List unclassified news
- **WHEN** an agent requests unclassified news
- **THEN** the system returns story clusters with no current cluster classification and no current mention-derived effective classification in stable publication order

#### Scenario: Keep processing state independent
- **WHEN** news is marked processed but its story cluster has no classification
- **THEN** the story cluster remains eligible for the unclassified queue

#### Scenario: Keep classification state independent
- **WHEN** a classification is created for unprocessed news or an unprocessed story cluster
- **THEN** the underlying news remains in unprocessed-news queries until separately processed

#### Scenario: Exclude mention-classified cluster
- **WHEN** any mention in a story cluster has a current classification and the cluster has no conflicting classification state
- **THEN** the unclassified queue excludes the cluster and exposes the mention-derived classification as effective classification metadata
