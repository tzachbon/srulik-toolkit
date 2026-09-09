# Architecture planning

## Contents

- Research current state before target state
- Architecture drivers
- Grill priorities
- Alternatives and decisions
- Target state
- Migration path
- Plan structure additions
- Validation

Apply these checks to system design, service boundaries, platform changes, data architecture, integration architecture, and major technical decisions.

## Research current state before target state

Establish:

- system boundaries and responsibilities
- interfaces, contracts, and data/control flows
- trust, process, transaction, persistence, and failure boundaries
- scale, latency, availability, durability, security, privacy, and compliance requirements
- operational model, ownership, and support expectations
- dependency, platform, and vendor constraints
- deployment topology and failure domains
- existing capacity and bottlenecks when relevant
- prior ADRs, rejected alternatives, and migration constraints

Label observed current state separately from proposed target state. Do not present aspiration as implemented behavior.

## Architecture drivers

Make measurable quality attributes and invariants explicit before choosing components.

Examples:

- throughput or latency threshold
- availability/recovery target
- consistency semantics
- data residency or privacy constraint
- isolation boundary
- portability requirement
- cost envelope
- operability/support requirement
- compatibility window

Architecture choices should trace back to these drivers.

## Grill priorities

Resolve the decisions that constrain downstream design:

- quality attributes and measurable thresholds
- invariants that must survive the change
- system and ownership boundaries
- build-vs-buy or platform choices
- consistency, availability, and failure semantics
- interface/versioning strategy
- migration and coexistence constraints
- reversibility and lock-in tolerance
- operational responsibility and escalation
- acceptable complexity and long-term maintenance burden

## Alternatives and decisions

For every significant decision, compare credible alternatives against the architecture drivers. Include the status quo when viable.

Capture:

- context
- options considered
- chosen option
- rationale tied to drivers
- positive and negative consequences
- risks
- revisit trigger

Do not use a pros/cons list without identifying which differences are decisive.

## Target state

Describe enough for downstream planning to reason about boundaries and contracts:

- components and responsibilities
- dependency direction
- important interfaces
- data/control flows
- state ownership
- failure and retry behavior
- observability
- operational ownership

Use diagrams only when they clarify relationships better than prose.

## Migration path

For changes to existing architecture, plan safe intermediate states:

- compatibility behavior
- source of truth
- synchronization or dual-write/read rules where applicable
- traffic/data transition
- rollback or roll-forward
- decommission trigger

Prefer staged transitions over big-bang migration when intermediate states materially reduce risk.

## Plan structure additions

Add when material:

```markdown
## Architecture drivers
- ...

## Architecture decisions
### Decision: <title>
- Context:
- Options considered:
- Chosen option:
- Rationale:
- Consequences:
- Revisit trigger:

## Target state
<Components, boundaries, interfaces, data flow, failure behavior, operational model.>

## Migration path
<Intermediate states, compatibility, cutover, rollback/roll-forward, decommissioning.>
```

## Validation

Tie validation to the architecture qualities that drove the design, not feature correctness alone. Include measurable checks for relevant non-functional requirements and failure behavior.

Before finalizing check that every major component or boundary exists because of an explicit responsibility or driver, not because the pattern is fashionable or familiar.
