---
name: create-plan
description: Create detailed, comprehensive, execution-ready plans for engineering, architecture, research, reviews, migrations, investigations, operations, strategy, decisions, and other multi-step work. Use when the user asks to create, write, improve, pressure-test, decompose, or validate a plan before execution. Research available context first, run a mandatory adaptive grilling loop to resolve consequential ambiguity, re-research evidence exposed by the grill, repeat until readiness gates pass, then produce a self-contained plan with scope, decisions, dependencies, risks, validation, acceptance criteria, and explicit skill handoffs.
metadata:
  skill-type: planning
---

# Create Plan

Create plans that a capable executor can carry out without rediscovering the problem. Keep one discipline-agnostic planning protocol at the root. Load specialist references only when the task benefits from them.

## Default depth: comprehensive

Default to a substantial, self-contained plan, even when conversational replies should be brief. A short delivery message may link to the full artifact; it must not replace the artifact with an outline. Shorten the plan only when the user requests it.

Assume the executor is capable but has no conversation history and little familiarity with the project, domain, or local conventions. Explain the problem, current behavior, intended behavior, relevant vocabulary, constraints, design rationale, and how each deliverable will be produced and verified. Include the details the executor would otherwise need to rediscover.

Use layered structure so the reader can scan the overview and then work through full task instructions. Keep material rationale and evidence in the plan even when they also appear in a source document. Repeat a critical contract in a separately delegated task when that executor would otherwise miss it. Remove filler and duplicate work, but preserve useful explanation, examples, edge cases, and recovery instructions. There is no word-count target: completeness determines length.

Read `references/detailed-plans.md` before drafting or revising the final plan. It defines the required depth, task format, and examples across disciplines. Read `references/quality-gates.md` before finalizing.

## Non-negotiable rules

1. Loop:
   1.1. Research before asking questions.
   1.2. Grill before finalizing every plan. The grill is mandatory.
2. Walk through the discussions and research. Ask the user to confirm or continue the loop.
3. Unless the user explicitly forbids interaction, run at least one actual adversarial grilling wave even when the request appears complete.
4. Ask only questions that require user judgment, intent, preference, ownership, approval, or unavailable context.
5. If evidence can answer a question, research it instead of asking the user.
6. After each answered grill wave, reconcile decisions and run targeted re-research before constructing the next wave when the answers expose verifiable facts or new planning surfaces.
7. Continue research -> grill -> re-research -> grill until the readiness gate passes or unresolved items are explicitly deferred without invalidating the executable plan.
8. Discover relevant available skills early. Invoke clearly applicable skills during planning when needed and always include exact execution-time skill handoffs in the final plan.
9. Never invent skill names, files, commands, APIs, owners, dates, requirements, source facts, or implementation details.
10. Separate verified facts, user decisions, inferences, and assumptions.
11. Prefer independently verifiable outcomes over activity lists.
12. Plan the work. Do not execute the planned work unless the user separately asks for execution.

## Route by discipline

Classify the task before deep research. A plan may use multiple routes.

- Engineering, implementation, refactoring, debugging remediation: read `references/engineering.md`.
- Architecture, system design, platform design, technical decisions: read `references/architecture.md`.
- Research, investigation, evaluation, evidence synthesis: read `references/research.md`.
- Review, audit, assessment, critique, readiness gate: read `references/review.md`.
- Migration, rollout, cutover, adoption, deprecation, organizational change: read `references/migration-change.md`.
- Strategy, product direction, policy, prioritization, major business decision: read `references/decision-strategy.md`.
- Operations, programs, launches, recurring processes, cross-functional delivery: read `references/operations-program.md`.
- Unlisted or unusual domain: read `references/domain-adaptation.md` and derive domain-native research, grilling, risk, and validation checks.
- Any planning request: read `references/grilling.md`, `references/skill-routing.md`, and `references/quality-gates.md` when their detail is needed.
- When the installed skill catalog lacks a material planning or execution capability, read `references/dynamic-skills.md` before declaring a capability gap.

For mixed-domain work, combine only relevant references. Do not force software-specific sections into non-software plans.

## Workflow

Follow this sequence. Loop between research and grilling as many times as needed.

### 1. Frame the planning target

Infer from the request and existing context:

- desired outcome and why it matters
- plan type and discipline routes
- known scope, exclusions, and boundaries
- stakes, reversibility, and blast radius
- likely executor and their assumed context
- expected deliverable or artifact
- time horizon, milestones, or deadline when material
- whether the plan is greenfield, change-to-existing-state, migration, review, or research

If an existing plan is supplied, treat it as evidence to inspect, not settled truth. Determine whether the task is to repair, deepen, decompose, or validate it.

### 2. Discover skills and research first

Before grilling, inspect available evidence and the installed skill catalog when the runtime supports them. Load installed matches when they apply. If no installed skill covers a material capability, follow `references/dynamic-skills.md` to search the open skill ecosystem and present qualified candidates. Search does not authorize installation. Ask about installation during planning only when the missing skill is required to finish the plan; defer execution-time candidates to the final skill handoff.

For engineering work that needs multiple phases or sessions, benefits from durable research, requirements, design, and task artifacts, and is expected to use autonomous implementation loops, follow the Smart Ralph companion routing in `references/skill-routing.md`. Difficulty or a multi-step plan alone does not qualify.

Use the strongest applicable sources available, such as:

- conversation context and user-provided files, specs, notes, and prior decisions
- relevant code, tests, configuration, schemas, interfaces, and repository conventions
- connected internal systems and organizational documentation
- authoritative external documentation and primary sources
- current web sources when freshness matters
- plans, ADRs, tickets, review findings, incident records, research artifacts, or operating documents

During research:

- map the current state and constraints
- identify decisions already made and their authority
- distinguish observed behavior from proposed state
- resolve answerable questions directly
- record contradictions and stale evidence
- identify material unknowns and decision branches
- identify dependencies, failure modes, and irreversible choices
- discover relevant installed skills and invoke those needed for planning evidence or analysis

Research to decision sufficiency, not exhaustiveness. Stop broad exploration once the next consequential uncertainty is clear.

### 3. Build the planning brief and decision ledger

Maintain a working brief throughout planning. The brief is a tracking aid; expand its execution-relevant content in the final plan:

- Objective
- Verified facts
- User decisions
- Inferences
- Assumptions
- Constraints and invariants
- Scope and non-goals
- Candidate approaches
- Material unknowns
- Dependencies
- Risks and irreversible choices
- Validation expectations
- Sources consulted
- Skills discovered, invoked, or likely needed later

Maintain a decision ledger for consequential branches:

```text
Decision | Status | Evidence/driver | Choice | Rationale | Revisit trigger
```

Use statuses: `open`, `decided`, `resolved`, `deferred`, `contradicted`.

### 4. Generate alternatives when a real choice exists

Do not silently lock onto the first plausible approach.

When materially different approaches exist:

1. Generate 2-3 credible alternatives.
2. Compare them against the actual decision drivers and constraints.
3. Include reversibility, failure cost, migration cost, operational burden, and long-term lock-in when relevant.
4. Research factual differences that can be verified.
5. Grill the user on the remaining judgment call with a recommended option.

Skip artificial alternatives when the evidence or constraints already determine the approach.

### 5. Grill the user

Follow `references/grilling.md`.

Map the unresolved decisions as a dependency tree, compute the currently answerable frontier, and ask that frontier in a numbered question wave. Default to 2-4 independent questions per wave, with a hard cap of 4. Use a one-question wave only when one upstream decision dominates or every other question depends on it.

Escalate through layers as the plan becomes clearer:

1. foundation: outcome, stakeholders, scope, non-goals, current state, hard constraints
2. shape: approaches, tradeoffs, interfaces, success thresholds, dependencies, ownership
3. edges and adversarial pressure: failure modes, contradictions, hidden assumptions, reversibility, second-order effects
4. execution and closure: sequencing, rollout, validation, recovery, approvals, handoffs

Questions in the same wave must be independently answerable from the current state. Never batch a downstream question with the upstream decision that determines how it should be asked. Every question should resolve one decision boundary or hidden assumption and include a recommended answer when useful.

Push on vague requirements, scope leakage, contradictory constraints, unsupported premises, missing thresholds, ownership gaps, edge cases, failure handling, and irreversible commitments.

Even when the brief appears complete, run one adversarial completeness wave against the highest-impact assumptions, tradeoffs, failure modes, or definitions of success that could still make the plan wrong.

Never ask the user to repeat something available in evidence.

### 6. Re-research after answers

After each answered grill wave, decide whether the answers expose verifiable evidence or change the planning surface.

Re-research when the answer:

- points to a file, system, document, dependency, standard, owner, constraint, or prior decision
- chooses an approach whose feasibility or implications should be verified
- depends on a factual premise
- contradicts existing evidence
- exposes a new domain, dependency, edge case, or risk
- changes the plan enough that earlier research may no longer apply

Update the brief and decision ledger, recompute the decision-tree frontier, then return to grilling with a new wave if material uncertainty remains.

### 7. Pass the readiness gate

Do not finalize while an unresolved item could materially change scope, approach, sequencing, feasibility, validation, ownership, or risk treatment.

Check:

- Outcome: success is observable and specific.
- Scope: in-scope and out-of-scope boundaries are clear.
- Current state: the relevant starting conditions are understood.
- Constraints: material technical, organizational, legal, policy, time, cost, compatibility, and resource constraints are known.
- Decisions: major approach choices are settled or intentionally deferred with a resolution path.
- Dependencies: upstream, downstream, external, and approval dependencies are identified.
- Interfaces: handoffs and contracts between workstreams are clear where relevant.
- Validation: every major outcome has evidence that can prove completion.
- Risk: consequential failure modes have mitigation, recovery, stop conditions, or explicit acceptance.
- Ownership: external inputs, approvals, and deferred decisions have owners or resolution sources where ownership matters.
- Execution context: a fresh executor can proceed without rediscovering critical context.
- Skills: planning-time skills were used where needed and execution-time skill handoffs are mapped.

If the user explicitly forbids questions, run the same grill internally, research everything resolvable, label remaining assumptions, and state that interaction-dependent uncertainties remain. The grill itself is still mandatory.

### 8. Draft the plan

Write the plan as a self-contained execution contract. A fresh executor should not need the original conversation to understand the goal, important constraints, settled decisions, sequencing, and evidence of completion.

Use this root structure unless a discipline reference calls for a small adaptation:

```markdown
# <Plan title>

## Objective

<What will be true when the plan succeeds, and why it matters.>

## Context and evidence

<Explain the current state and problem mechanism, affected people/systems, evidence, and why the change is needed. Include source pointers and material limits of the evidence.>

## Requirements and constraints

<Assign stable IDs to material requirements and observable acceptance conditions. Define global invariants and constraints with verified values. Explain relevant domain terms.>

## Decisions and assumptions

- Decision: <settled choice and rationale>
- Assumption: <only if unresolved, with impact and validation method>

## Scope

### In scope

- ...

### Out of scope

- ...

## Approach

<Explain the proposed state, how the parts interact, why this approach fits the evidence, credible alternatives rejected and their tradeoffs, and the reason for the sequence.>

## Artifact and dependency map

<Name the files, documents, systems, or datasets involved, each responsibility, and the contracts between workstreams. Distinguish verified existing artifacts from proposed new artifacts. Identify prerequisites, safe parallel work, and integration checkpoints.>

## Work plan

### 1. <Outcome or workstream>

**Purpose and requirements:** <Why this task exists, requirement IDs, observable outcome.>

**Starting context:** <What the executor must know, read, and have available; prerequisites and task dependencies.>

**Artifacts and contracts:** <Exact verified targets or explicitly proposed new ones; responsibilities; inputs, outputs, and interfaces.>

**Execution steps:**

- [ ] <One bounded action. Supply the method, relevant content or example, and expected intermediate result.>
- [ ] <Next action in dependency order. Include concrete edge-case and failure behavior where relevant.>
- [ ] <Verification action with the procedure, expected result or threshold, and evidence to retain.>

**Completion gate:** <What proves this task can be accepted and dependent work can begin.>

**Failure and recovery:** <Material failure signals, stop conditions, fallback or recovery procedure.>

**Handoff:** <Downstream consumer, output contract, and exact discovered skills with invocation timing, if applicable.>

### 2. <Outcome or workstream>

...

## Cross-cutting concerns

<Only concerns that span multiple workstreams, such as security, privacy, compatibility, data, performance, operations, governance, communication, or change management.>

## Acceptance criteria

| Requirement | Observable acceptance condition | Task(s) | Verification and evidence |
| --- | --- | --- | --- |
| <ID> | <Condition> | <Task IDs> | <Procedure and proof> |

## End-to-end verification

<Describe the complete user journey, system behavior, research conclusion, or operational outcome to verify after task-level checks. State prerequisites, procedure, expected results, evidence location, and failure response.>

## Risks and mitigations

- <Risk> -> <mitigation, fallback, stop condition, or accepted exposure>

## Open and deferred items

- <Item> -> <owner/source to resolve it> -> <when it must be resolved> -> <impact if unresolved>

## Skill handoff

- During planning: <exact skill> -> <what it contributed>
- During execution: <phase/workstream> -> <exact skill> -> <trigger> -> <expected output>
- Missing capability: <needed capability when no installed skill was found>

## References

- <source, file, document, issue, URL, decision record, or other evidence>
```

Omit empty sections. Add discipline-specific sections when they improve execution. The template is a scaffold: expand each substantive section into explanations, tables, examples, and executable steps as needed. Do not treat its short placeholders as the intended output length.

### 9. Right-size and sequence work items

A work item should usually be the smallest unit that:

- produces a meaningful outcome
- can be validated independently
- has a coherent dependency boundary
- exposes a clear output or interface to dependent work
- could be reviewed, accepted, rolled back, or rejected separately when relevant

Give work items stable IDs and explicit dependencies. Within each engineering work item, provide ordered checkbox steps with concrete implementation and verification detail. For research or review, use evidence-producing stages rather than implementation-style microsteps.

Build the dependency graph before final ordering. Do not sequence by narrative convenience.

Split the plan when independent subsystems or goals can succeed, fail, ship, or be reviewed separately. If a plan becomes too large for one executor to hold reliably, create subplans and define their contracts explicitly.

### 10. Run plan QA

Follow `references/quality-gates.md`.

Review the draft as both a skeptical executor and a skeptical approver. At minimum verify:

- sufficient explanatory depth for an executor with no conversation history
- complete requirement and scope coverage, visible in the acceptance traceability table
- no unexplained execution context
- dependency-correct ordering
- outcome-based validation rather than activity completion
- visible assumptions and deferred decisions
- recovery or stop conditions for consequential risks
- factual claims supported by inspected evidence
- exact names, paths, commands, APIs, owners, dates, and skills verified rather than guessed
- skill handoff present and phase-specific
- no placeholders that research should have resolved
- no duplicate, decorative, or non-actionable work; no removal of useful context merely to make the plan shorter

If QA reveals a material gap, return to research and grilling. Do not patch over it with a vague TODO.

## Skill orchestration

Skill selection is part of planning and execution design. Follow `references/skill-routing.md`.

At minimum:

1. Discover available skills relevant to the task before deep planning when the runtime supports discovery.
2. Invoke matching skills needed to research, inspect, analyze, or create planning artifacts.
3. Re-check skill needs after grilling reveals new domains, tools, artifacts, or risk surfaces.
4. Use `references/dynamic-skills.md` when installed skills leave a material gap; distinguish installed skills, external candidates, and unresolved capabilities.
5. Include `## Skill handoff` in every final plan.
6. For every recommended skill, state exact invocation timing and expected output or decision.
7. If no qualified installed or external skill exists, state the missing capability instead of inventing a skill name.

## Evidence discipline

Use precise provenance:

- Verified: directly supported by inspected evidence.
- Decided: explicitly chosen by the user or an authoritative decision record.
- Inferred: reasoned from evidence but not directly stated.
- Assumed: necessary for planning but unresolved.

Convert material assumptions into research or grill questions whenever possible. Treat secondary sources as pointers when primary evidence is available. Record source freshness when it materially affects the plan.
