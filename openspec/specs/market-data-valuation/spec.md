# market-data-valuation Specification

## Purpose
TBD - created by archiving change add-portfolio-accounting-foundations. Update Purpose after archive.
## Requirements
### Requirement: Historical asset prices
The system SHALL store immutable historical asset price observations with asset, effective date or timestamp, value, quote currency, source, and audit timestamps.

#### Scenario: Record price observation
- **WHEN** a client submits a valid price for an asset, effective time, currency, and source
- **THEN** the system stores the observation with a stable identifier without overwriting observations from other sources

#### Scenario: Reject invalid price
- **WHEN** a client submits a negative price or an unsupported currency code
- **THEN** the system rejects the observation without persisting it

### Requirement: Historical foreign-exchange rates
The system SHALL store immutable foreign-exchange observations with base currency, quote currency, effective date or timestamp, positive rate, source, and audit timestamps.

#### Scenario: Record exchange rate
- **WHEN** a client submits a valid rate for a currency pair, effective time, and source
- **THEN** the system stores the observation with a stable identifier

#### Scenario: Reject identical currency pair
- **WHEN** a client submits an exchange rate whose base and quote currencies are identical
- **THEN** the system rejects the observation as invalid

### Requirement: Configurable portfolio base currency
The system SHALL store a three-letter base currency for each portfolio and SHALL preserve all monetary facts in their original currencies.

#### Scenario: Change base currency
- **WHEN** a client changes a portfolio base currency from one supported currency to another
- **THEN** future valuation queries use the new base currency without rewriting operations, costs, prices, or exchange-rate observations

### Requirement: Deterministic historical valuation
The system SHALL value a position at a requested date using an applicable price and, when needed, an applicable exchange rate selected by an explicit source or a documented deterministic selection rule.

#### Scenario: Value same-currency position
- **WHEN** the selected asset price is already denominated in the portfolio base currency
- **THEN** the system returns original and base values without applying an FX observation

#### Scenario: Value foreign-currency position
- **WHEN** the selected asset price is denominated in a different currency and a valid direct or inverse FX observation is available
- **THEN** the system returns original value, converted base value, price observation identifier, FX observation identifier, and whether inversion was used

#### Scenario: Required market data is missing
- **WHEN** no applicable price or exchange rate exists under the requested selection policy
- **THEN** the system returns a structured unavailable valuation with the missing asset, currency pair, date, and source criteria instead of using a current quote

### Requirement: Valuation and performance provenance
The system SHALL expose the original-currency inputs, base-currency outputs, effective dates, and source observation identifiers used for mechanically derived valuation and gain or loss amounts.

#### Scenario: Query position valuation inputs
- **WHEN** a client requests a valued portfolio
- **THEN** each valued position identifies its quantity, original currency, price input, FX input when applicable, base currency, and converted amount

#### Scenario: Cost basis is unknown
- **WHEN** a position has an unknown opening or transferred cost basis
- **THEN** the system returns valuation when possible but marks cost-based gain or loss as unavailable rather than treating cost as zero

### Requirement: Historical benchmark observations
The system SHALL store immutable benchmark observations with benchmark,
effective date or timestamp, numeric value, currency when monetary, source, and
audit timestamps.

#### Scenario: Record benchmark observation
- **WHEN** a client submits a valid observation for a known benchmark, effective time, value, currency, and source
- **THEN** the system stores it with a stable identifier without overwriting observations from other sources

#### Scenario: Reject invalid benchmark observation
- **WHEN** a client submits a non-positive value, unknown benchmark, invalid currency, or missing source
- **THEN** the system rejects the observation without persisting it

### Requirement: Deterministic benchmark observation selection
The system SHALL select benchmark observations by explicit source when supplied
or by documented deterministic source and effective-time ordering. For an
evolution sample after the baseline, the selected observation MUST be effective
after the previous sample and on or before the current sample, preventing silent
carry-forward across an interval with no observation.

#### Scenario: Select observation for comparison period
- **WHEN** multiple applicable benchmark observations exist after the previous sample and on or before the current sample
- **THEN** the system selects one deterministically and returns its identifier, effective time, source, and selection policy

#### Scenario: Do not silently fill missing benchmark history
- **WHEN** no applicable benchmark observation exists for a sample under the requested policy
- **THEN** the system returns a structured missing-benchmark diagnostic and does not use a future observation or unrelated source

