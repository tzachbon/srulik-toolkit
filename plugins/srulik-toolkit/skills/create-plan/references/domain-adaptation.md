# Domain adaptation

Use this reference when the planning domain is not covered by a specialist route, or when a mixed-domain task has a substantial surface outside the existing references.

Do not invent a domain template first. Derive the specialist checks from the root planning contract.

## Derive the route

Answer these questions through research and grilling:

1. What evidence establishes the current state?
2. What outcome or decision defines success?
3. Which constraints or invariants cannot be violated?
4. Which choices can materially change the plan shape?
5. What dependencies, interfaces, stakeholders, or external conditions control feasibility?
6. What are the characteristic failure modes of this domain?
7. Which actions are hard to reverse or expensive to correct?
8. What evidence would convince a skeptical domain expert that each outcome is complete?
9. Which specialist skills, tools, reviewers, or approvals are required?

## Build domain-specific research checks

Prefer authoritative evidence for the domain. Examples include:

- governing policies, regulations, standards, or contracts
- primary datasets and measurement definitions
- existing procedures and systems of record
- subject-matter documentation and prior decisions
- representative artifacts or cases
- current external conditions when freshness matters

Identify evidence freshness and authority requirements before relying on sources.

## Build domain-specific grill checks

Ask about decisions evidence cannot settle, especially:

- success thresholds
- tradeoff preferences
- risk tolerance
- stakeholder priorities
- exceptions
- ownership
- acceptable failure/recovery behavior
- irreversible commitments

Use the pressure-test lenses from `grilling.md`.

## Build domain-specific validation

Translate "done" into evidence native to the domain. Avoid generic validation such as "review" or "ensure quality".

Possible evidence classes include:

- test or measurement
- audit evidence
- approval
- acceptance by a named role
- observed metric threshold
- artifact completeness
- reconciliation or integrity check
- controlled experiment
- dry run or rehearsal
- legal/policy conformity check
- operational health over a defined period

## Add a new permanent reference only when reusable

If the same domain planning pattern is likely to recur, propose adding a new reference file to this skill. Keep the root protocol unchanged unless the new insight is genuinely cross-domain.
