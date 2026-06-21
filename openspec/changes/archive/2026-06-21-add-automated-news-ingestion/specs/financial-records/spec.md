## MODIFIED Requirements

### Requirement: News records
The system SHALL store news items with stable source identity, source-provided
external identifier when available, original and canonical URLs, title,
summary, optional full article body, published and retrieved timestamps,
language, region, topic metadata, raw content hash, duplicate-group metadata,
related assets, processing state, and audit timestamps.

#### Scenario: Create news linked to assets
- **WHEN** a client submits a news item referencing one or more known assets
- **THEN** the system stores the news item and links it to those assets

#### Scenario: Store collected source provenance
- **WHEN** a source adapter persists a normalized news candidate
- **THEN** the stored item identifies the registered source and retains its ingestion identity and retrieval provenance

#### Scenario: Store full internal-use content
- **WHEN** the collector obtains a full article body from an enabled source
- **THEN** the system stores the body with the news item without requiring a metadata-only restriction

#### Scenario: Store news without intelligence
- **WHEN** a news item is created or enriched
- **THEN** the system stores factual source content and metadata only and does not assign recommendation, impact score, sentiment score, or thesis status
