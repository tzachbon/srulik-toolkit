# Grilling protocol

## Contents

- Purpose and minimum grill invariant
- Design tree and frontier
- Question waves and depth layers
- Wave construction and format
- Answer processing and branch closure
- Pressure-test lenses
- Pushback and research rules
- Re-research triggers
- Completion test

Use this protocol after initial research and again whenever new material uncertainty appears. Grilling is mandatory for every plan.

## Purpose

Extract decisions, constraints, and tacit knowledge that evidence cannot supply. Treat the grill as a decision-resolution and pressure-testing mechanism, not a questionnaire.

## Minimum grill invariant

Unless the user explicitly forbids interaction, run at least one substantive adversarial question wave before finalizing a plan.

If normal research leaves no obvious ambiguity, build a small adversarial wave around the highest-impact remaining assumptions, tradeoffs, failure modes, or definitions of success. The point is to test whether apparent completeness survives scrutiny.

## Build the design tree first

Model consequential unresolved decisions as a dependency tree or DAG before asking questions.

For each decision, identify:

- what must already be known before it can be answered well
- what downstream choices depend on it
- whether evidence can resolve it without asking the user
- whether it is a fact, preference, constraint, approval, ownership question, or tradeoff
- its impact on scope, approach, feasibility, sequencing, validation, or risk

The **frontier** is the set of material decisions whose prerequisites are already resolved and that still require user judgment. Only frontier decisions are eligible for the next wave.

Never place two questions in the same wave when one answer could materially change how the other should be asked. Keep dependent questions for the next wave.

## Use question waves, not a serial interview

Ask the currently useful frontier as a numbered wave. Default to 2-4 questions per wave, with a hard cap of 4. A one-question wave is valid only when a single decision dominates the frontier or when all other questions depend on it.

Do not dump every unknown at once. Recompute the frontier after every answered wave.

If the frontier contains more than four viable questions, select the four with the highest combination of:

1. upstream dependency impact
2. consequence if guessed incorrectly
3. irreversibility or blast radius
4. ability to collapse multiple downstream branches

Queue the rest for later waves.

If repeated waves keep expanding rather than converging, the planning target is probably too broad. Propose splitting it into subplans with explicit interfaces, then grill each subplan separately.

## Escalate through depth layers

Move from surface certainty to deeper pressure-testing. Layers guide wave selection; they are not a checklist.

### Layer 1: foundation

Pin the planning target before debating implementation details:

- desired outcome and why it matters
- primary users, stakeholders, or decision audience
- scope and non-goals
- current state or core flow
- hard constraints already known

Prefer 3-4 questions only when these are genuinely unresolved. Skip anything already established by evidence or the user.

### Layer 2: shape and tradeoffs

Once the foundation is stable, resolve the plan's shape:

- candidate approaches and meaningful tradeoffs
- inputs, outputs, interfaces, or handoffs
- constraints such as time, cost, compatibility, performance, policy, or resources
- success thresholds and acceptance evidence
- dependencies, ownership, and integration with existing systems or processes

Prefer 2-4 questions. Do not ask downstream shape questions whose wording depends on an unresolved foundation choice.

### Layer 3: edges and adversarial pressure

Once a plausible plan shape exists, attack it:

- edge cases and failure modes
- contradictions between evidence, assumptions, and user answers
- hidden premises and proxy objectives
- irreversible commitments and recovery paths
- second-order effects and operational burden
- strongest credible alternative or status quo
- evidence that would change the preferred decision

Prefer 1-4 questions that resolve the most consequential decisions. Concrete scenarios are better than generic prompts about "edge cases" or "risks."

### Layer 4: execution and closure

Use when execution details could still invalidate the plan:

- sequencing and dependency order
- rollout, migration, cutover, or communication
- validation ownership and acceptance evidence
- recovery, abort, rollback, or stop conditions
- unresolved approvals, handoffs, and skill invocation points

Ask only what must be decided before a fresh executor can proceed safely.

## Construct each wave for cheap answers

Number every question. Give the user enough context to answer the whole wave in one response.

Use this shape when useful:

```markdown
### Grill wave <N>: <layer or focus>

1. **<decision title>**
   <specific question stated in user-facing outcome language>
   - Recommended: <best current answer based on evidence and why>
   - Alternatives: <only credible alternatives and their consequence>

2. **<decision title>**
   ...
```

Rules:

- Each numbered item targets one decision boundary.
- Every item should be answerable independently from the other items in the same wave.
- Include a recommended answer whenever a useful recommendation can be made.
- Offer 2-4 concrete options when discrete alternatives exist.
- Prefer user-facing outcomes over internal implementation terminology unless the user is already operating at that technical level.
- After the user chooses an outcome, translate it into exact technical, operational, research, or policy language in the decision ledger when needed.
- Avoid broad prompts such as "What do you think?" or "Any other requirements?"

The user should be able to reply compactly, for example: `1 recommended, 2 option B because..., 3 defer to security review`.

## Process the whole wave before asking the next one

After the user answers a wave:

1. Normalize each answer into a concrete decision, constraint, flag, or unresolved branch.
2. Preserve exact wording where it is load-bearing.
3. Update the planning brief and decision ledger.
4. Mark each branch as `decided`, `resolved`, `deferred`, `contradicted`, or `open`.
5. Identify contradictions or vague answers that need follow-up.
6. Re-research any factual premise, named artifact, system, standard, dependency, or feasibility claim exposed by the answers.
7. Recompute the design-tree frontier.
8. Build the next wave from the new frontier at the appropriate depth layer.

Do not ask the next wave before completing steps 1-7.

## Drill branches without violating wave discipline

Depth-first does not mean one question per turn. It means a branch must not be treated as closed while consequential consequences remain unresolved.

When an answer opens follow-up decisions:

- add those decisions as child nodes
- research any answerable child nodes yourself
- place only dependency-ready child nodes on the next frontier
- combine them with other independent frontier nodes when doing so stays within the four-question cap

If a vague answer can be sharpened with a concrete interpretation, state the interpretation and make confirmation or correction one item in the next wave rather than repeating the original broad question.

## Pressure-test lenses

Choose lenses silently based on the planning problem. Do not run them mechanically or name-drop them unless useful.

### First principles

Separate the actual outcome and constraints from inherited process, precedent, or proposed solution.

### Inversion and pre-mortem

Assume the plan failed despite competent execution. Ask which hidden premise, dependency, or failure mode most plausibly caused it.

### Reversibility

Distinguish reversible experiments from hard-to-reverse commitments. Demand stronger evidence for irreversible choices.

### Steelman the alternative

Before settling a disputed choice, articulate the strongest credible case for the leading alternative. Check whether the current rationale survives it.

### Second-order effects

Ask what new operational burden, incentive, dependency, maintenance cost, behavior, or failure mode the plan creates after the immediate outcome succeeds.

### Status quo

Treat "do nothing" or "delay" as a real option when viable. Compare its cost and risk instead of assuming change is mandatory.

### Evidence-to-change

Ask what evidence would cause the user to change the preferred decision. If no imaginable evidence would change it, identify whether the choice is actually a constraint or value judgment rather than an evidence-based decision.

### Audience and ownership

Test whether the plan reflects the needs of the people who approve, execute, operate, support, or are affected by the outcome.

## Pushback rules

Challenge answers when they are:

- vague enough to permit incompatible plans
- inconsistent with evidence or prior answers
- based on an unverified factual premise
- missing a measurable or observable success threshold
- hiding a consequential assumption
- treating a reversible choice as irreversible, or the reverse
- ignoring a likely failure mode, external dependency, or affected stakeholder
- delegating a critical decision without identifying an owner or source
- optimizing a proxy whose connection to the real objective is unclear

Challenge the idea, not the person. Keep pushback concise and specific.

## Research instead of asking

Do not ask questions such as:

- Which file implements this behavior? when the repository can be inspected.
- What does the vendor API support? when authoritative documentation can be checked.
- What did the prior decision say? when the ADR or ticket is available.
- What is the current policy? when an authoritative internal source can be queried.
- What is the current market or regulatory state? when current research can establish it.

Research first, then ask only for judgment that remains unresolved.

## Re-research triggers

Re-enter research between waves when an answer reveals:

- a named artifact or source
- a new domain or system boundary
- a factual claim that affects feasibility
- a choice that changes candidate architecture or method
- a contradiction
- a new high-risk condition
- an external dependency whose current state matters

Do not carry a factual uncertainty into another grill wave when available evidence can resolve it first.

## Completion test

The grill is complete only when the decision-tree frontier contains no unresolved item that could materially change plan shape, sequencing, feasibility, validation, ownership, or risk treatment.

Remaining unknowns must be either:

- immaterial to execution, or
- explicitly deferred with owner/source, latest safe resolution point, impact, and a plan step that resolves them before dependent work.

Before finalizing, run one final adversarial wave at Layer 3 or 4. Challenge the strongest remaining blind spots directly instead of asking a generic "anything else?" question.
