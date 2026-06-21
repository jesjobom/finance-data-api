# portfolio-analytics Specification

## Purpose
TBD - created by archiving change add-portfolio-analytics-queries. Update Purpose after archive.
## Requirements
### Requirement: Point-in-time portfolio analytics
The system SHALL provide a portfolio analytics summary for a requested date
containing total base-currency market value, opening value at `reliableFrom`,
cumulative contributions, cumulative withdrawals, net external flow, and
gain or loss separated from external flow.

The system SHALL define net external flow as contributions minus withdrawals.
When all required values are available, gain or loss since `reliableFrom` SHALL
equal ending market value minus opening market value minus net external flow.

#### Scenario: Calculate complete point-in-time analytics
- **WHEN** a client requests analytics on or after `reliableFrom` and all opening, flow, price, and FX inputs are available
- **THEN** the system returns the component values, formula result, base currency, requested date, and provenance used

#### Scenario: Preserve unavailable analytics component
- **WHEN** opening value or an external flow cannot be valued deterministically
- **THEN** the system returns the known components but marks gain or loss unavailable instead of treating the missing amount as zero

### Requirement: External cash-flow classification
The system SHALL classify only contribution and withdrawal operations as
external portfolio flows. Buys, sells, transfers, dividends, yields,
redemptions, maturities, splits, reverse splits, and bonuses SHALL NOT be
classified as external flows.

#### Scenario: Exclude internal transactions from net flow
- **WHEN** a period contains buys, sells, dividends, transfers, and one contribution
- **THEN** cumulative external flow includes only the contribution while the other events remain part of portfolio value and gain-or-loss calculation

#### Scenario: Value an in-kind external flow
- **WHEN** a contribution or withdrawal is denominated in an asset rather than portfolio base-currency cash
- **THEN** the system values the flow at its effective date using explicit operation value inputs or deterministic historical price and FX observations and returns their provenance

### Requirement: Portfolio evolution series
The system SHALL provide a bounded portfolio evolution query with `from`, `to`,
and an explicit supported sampling interval. Each sample SHALL use the same
point-in-time formulas and deterministic end-of-period date rules.

#### Scenario: Produce monthly evolution
- **WHEN** a client requests monthly evolution over a valid date range
- **THEN** the system returns chronologically ordered month-end samples containing market value, cumulative net external flow, gain or loss when available, and completeness metadata

#### Scenario: Reject unsafe evolution range
- **WHEN** a requested range or sample count exceeds documented service limits
- **THEN** the system rejects the request with a structured validation error rather than performing unbounded calculation

### Requirement: Asset allocation and concentration
The system SHALL return valued allocation by asset and SHALL provide
concentration for a configurable top-N count using base-currency market value.
The response SHALL include each asset weight, cumulative top-N weight, and the
remaining portfolio weight.

#### Scenario: Return top-five concentration
- **WHEN** a client requests concentration with `top=5` and all positions are valued
- **THEN** the system returns the five largest assets in stable descending-value order, their individual weights, cumulative weight, and remaining weight

#### Scenario: Exclude unavailable values from false percentages
- **WHEN** one or more positions cannot be valued
- **THEN** the system identifies excluded positions and does not present weights over the known subtotal as complete whole-portfolio weights

### Requirement: Normalized benchmark comparison
The system SHALL compare portfolio evolution with a selected benchmark as
normalized index series beginning at 100 on the first sample where both series
have complete values. The response SHALL NOT label the normalized difference as
time-weighted return, money-weighted return, alpha, or investment advice.

#### Scenario: Compare complete portfolio and benchmark series
- **WHEN** portfolio and benchmark observations are available for every requested sample
- **THEN** the system returns aligned portfolio and benchmark index values with the common normalization date and observation provenance

#### Scenario: Report benchmark gap
- **WHEN** a benchmark observation is unavailable for a requested sample
- **THEN** the system preserves the sample with an unavailable benchmark value and diagnostic instead of silently forward-filling or substituting another source

### Requirement: Analytics completeness envelope
Every analytics response SHALL include a completeness status and structured
diagnostics covering the reliability boundary, unknown cost or opening value,
missing price, missing FX, missing benchmark observation, unresolved statement
asset, and pending factual processing relevant to the result.

#### Scenario: Return complete analytics
- **WHEN** all required factual and market-data inputs are available and no relevant work is pending
- **THEN** the response status is complete and its diagnostics collection is empty

#### Scenario: Return partial analytics
- **WHEN** one or more required or relevant inputs are unavailable or pending
- **THEN** the response status is partial or unavailable and each diagnostic identifies its type, affected record or series, date, and required remediation input

