# Migration and change planning

Apply these checks to system migrations, data migrations, platform moves, API/version transitions, deprecations, operational cutovers, user adoption, process changes, and organizational transitions.

## Research the starting state

Map:

- source and target states
- populations, systems, data, workflows, or teams affected
- compatibility and coexistence requirements
- dependency graph
- current traffic/usage or process volume when relevant
- data integrity or state invariants
- support and ownership model
- contractual, legal, policy, or timing constraints
- prior migration failures or lessons

## Grill priorities

Resolve:

- what must remain continuously available
- whether source and target must coexist
- acceptable outage, degradation, or inconsistency windows
- migration unit and sequencing
- rollback versus roll-forward preference
- irreversible transformations
- success, abort, and completion thresholds
- ownership of exceptions and stragglers
- communication and adoption requirements
- decommission criteria

## Transition states

Plan intermediate states explicitly. For each state identify:

- what is active
- what remains compatible
- which source of truth is authoritative
- how data or work stays synchronized
- observability and integrity checks
- entry and exit criteria
- rollback or recovery path

Prefer staged transitions when they materially reduce blast radius or improve evidence.

## Plan structure additions

Add when material:

```markdown
## Migration model
<Units, waves, sequencing, coexistence, source-of-truth rules.>

## Readiness criteria
- ...

## Cutover
- Preconditions:
- Procedure:
- Validation:
- Abort thresholds:

## Rollback or roll-forward
<Recovery strategy and feasibility limits.>

## Decommissioning
<When the old path can be removed and what evidence proves it is safe.>
```

## Validation

Include checks for:

- completeness
- integrity
- compatibility
- behavior equivalence or intended differences
- performance/capacity where relevant
- user or operator adoption
- support load
- lingering source dependencies

Do not call a migration complete while fallback dependencies or shadow traffic remain unless the plan explicitly defines that as an accepted steady state.
