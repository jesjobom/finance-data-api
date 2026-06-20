## ADDED Requirements

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
