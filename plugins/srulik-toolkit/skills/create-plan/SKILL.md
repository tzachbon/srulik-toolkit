---
name: create-plan
description: Create detailed, comprehensive, execution-ready plans for engineering, architecture, research, reviews, migrations, investigations, operations, strategy, decisions, and other multi-step work. Use when the user asks to create, write, improve, pressure-test, decompose, or validate a plan before execution. Research available context first, run a mandatory adaptive grilling loop to resolve consequential ambiguity, re-research evidence exposed by the grill, repeat until readiness gates pass, then draft, review, and revise until no actionable review comments remain within the agreed scope. Produce a self-contained plan with decisions, dependencies, risks, validation, acceptance criteria, and explicit skill handoffs.
metadata:
  skill-type: planning
---

# Create Plan

Create plans a capable executor can carry out without rediscovering the problem. This file holds one discipline-agnostic planning protocol; load a specialist reference only when its route applies.

## Default depth: comprehensive

Default to a substantial, self-contained plan, even when conversational replies should be brief. Comprehensive means decision-complete, not maximally large: completeness determines length. A short delivery message may link to the full artifact; the artifact itself stays complete, never an outline. Shorten the plan only when the user requests it.

Write for an executor who is capable but has no conversation history and little familiarity with the project, domain, or local conventions. Explain the problem, current behavior, intended behavior, relevant vocabulary, constraints, design rationale, and how each deliverable will be produced and verified: every detail the executor would otherwise rediscover.

Read `references/detailed-plans.md` before drafting or revising the final plan; it sets the depth, structure, and task format, with examples across disciplines. Read `references/quality-gates.md` before finalizing.

## Non-negotiable rules

1. Loop:
   1.1. Research before asking questions.
   1.2. Grill before finalizing every plan. The grill is mandatory.
2. Enforce the **Outcome and Definition of Done gate** in `references/grilling.md`. When either is not explicit in the conversation, a supplied plan or specification, or an authoritative project artifact, ask separate grill questions for the missing decisions. Only an explicit statement closes the gate; inference and assumptions leave it open.
3. Walk the user through the discussions and research, and ask them to confirm or continue the loop.
4. Run at least one actual adversarial grill wave, even when the request appears complete, unless the user explicitly forbids interaction.
5. Ask only questions that require user judgment, intent, preference, ownership, approval, or unavailable context.
6. Research whatever evidence can answer instead of asking the user.
7. After each answered grill wave, reconcile decisions and run targeted re-research before constructing the next wave when the answers expose verifiable facts or new planning surfaces.
8. Continue research -> grill -> re-research -> grill until the readiness gate passes or unresolved items are explicitly deferred without invalidating the executable plan.
9. Inspect installed skills and classify material disciplines early. For every non-trivial plan, run external skill discovery per material discipline. Discovery is mandatory; loading or installing a discovered skill is not.
10. Take every skill name, file, command, API, owner, date, requirement, source fact, and implementation detail from evidence. Never invent one.
11. Separate verified facts, user decisions, inferences, and assumptions.
12. Prefer independently verifiable outcomes over activity lists.
13. Plan the work. Do not execute the planned work unless the user separately asks for execution. Running `make-it-verifiable` contract mode in a scratch copy outside the repository is planning evidence, not execution.
14. Invoke `keep-it-simple` after research establishes the requirements and before selecting approaches or work items. Apply it again during plan QA. In plans, "minimal" means avoiding unnecessary complexity, not limiting ambition. Preserve completeness, safety, validation, and acceptance evidence.
15. Every coding plan must include a `## Technical / Coding` section. Follow `references/engineering.md`: use `show-me` for the smallest useful design visual, describe system APIs when applicable, and provide an implementation-ready low-level design. A simple fix may omit irrelevant subsections, but not the root section.

## Route by discipline

Classify the task before deep research. A plan may take several routes; combine only the relevant references, and keep software-specific sections out of non-software plans.

- Engineering, implementation, refactoring, debugging remediation: read `references/engineering.md`.
- Architecture, system design, platform design, technical decisions: read `references/architecture.md`.
- Research, investigation, evaluation, evidence synthesis: read `references/research.md`.
- Review, audit, assessment, critique, readiness gate: read `references/review.md`.
- Migration, rollout, cutover, adoption, deprecation, organizational change: read `references/migration-change.md`.
- Strategy, product direction, policy, prioritization, major business decision: read `references/decision-strategy.md`.
- Operations, programs, launches, recurring processes, cross-functional delivery: read `references/operations-program.md`.
- Unlisted or unusual domain: read `references/domain-adaptation.md` and derive domain-native research, grilling, risk, and validation checks.
- Any planning request: read `references/grilling.md`, `references/skill-routing.md`, `references/dynamic-skills.md`, and `references/quality-gates.md` when their detail is needed; apply the strict external discovery gate before finalizing.

## Workflow

Follow these steps in order, looping between research and the grill as often as needed. Each step ends on a `Done when` criterion; meet it before moving on.

### 1. Frame the planning target

Infer from the request and existing context:

- desired outcome and why it matters
- plan type and discipline routes
- known scope, exclusions, and boundaries
- stakes, door (reversibility), and blast radius
- likely executor and their assumed context
- expected deliverable or artifact
- time horizon, milestones, or deadline when material
- whether the plan is greenfield, change-to-existing-state, migration, review, or research

Treat a supplied plan as evidence to inspect, not settled truth, and decide whether the task is to repair, deepen, decompose, or validate it.

Done when every item above has an inferred value or is listed as a material unknown for research or the grill.

### 2. Discover skills and research first

Follow [references/discovery-and-research.md](references/discovery-and-research.md) for external skill discovery, research sources, and the Verify prior art protocol.

Done when every material discipline has its installed-catalog result and external search recorded (or every strict-trivial condition is evidenced), prior-art verification is recorded, and the next consequential uncertainty is clear.

### 3. Build the planning brief and decision ledger

Follow [references/planning-brief.md](references/planning-brief.md) for the brief, the impact and risk assessment, the decision ledger, and evidence discipline.

Done when the brief exists, every consequential branch found so far has a ledger row with a status, and each consequential decision or step has its impact, blast radius, and door recorded.

### 4. Generate alternatives when a real choice exists

Compare credible approaches before committing to one, rather than locking onto the first plausible approach.

Before selecting or comparing approaches, invoke `keep-it-simple` and remove any option that adds work, an abstraction, or an adapter without advancing a current requirement.

When materially different approaches exist:

1. Generate 2-3 credible alternatives.
2. Compare them against the actual decision drivers and constraints.
3. Include reversibility, failure cost, migration cost, operational burden, and long-term lock-in when relevant.
4. Research factual differences that can be verified.
5. Grill the user on the remaining judgment call with a recommended option.

Skip artificial alternatives when the evidence or constraints already determine the approach.

Done when the ledger records the chosen approach with its rejected alternatives and tradeoffs, or the remaining judgment call is queued for the grill with a recommended option.

### 5. Grill the user

Follow `references/grilling.md`. It owns the design tree and frontier, grill wave construction, depth layers, pushback, and re-research triggers.

Apply the **Outcome and Definition of Done gate** before other discretionary questions. Inspect the conversation, supplied plans or specifications, and authoritative project artifacts. If the Expected outcome or Definition of Done is not directly stated, place each missing item on the earliest eligible foundation frontier and ask separate grill questions. When both are missing, ask both as distinct questions in that wave. They occupy two slots within the wave's hard cap of 4; defer lower-priority frontier questions instead of exceeding the cap. An inferred answer, recommendation, or labeled assumption does not close either decision.

Map the unresolved decisions as a dependency tree, compute the currently answerable frontier, and ask that frontier as a numbered grill wave: 2-4 independent questions by default, with a hard cap of 4, and one question only when one upstream decision dominates or every other question depends on it. Escalate from foundation to shape to adversarial edges to execution closure. Push on vague requirements, scope leakage, contradictory constraints, unsupported premises, missing thresholds, ownership gaps, edge cases, failure handling, and irreversible commitments.

Done when every answer in the wave is normalized into the brief and decision ledger, with each branch marked by status.

### 6. Re-research after answers

After each answered grill wave, re-research whenever the answers expose verifiable evidence or change the planning surface; `references/grilling.md` lists the triggers. Update the brief and decision ledger, recompute the decision-tree frontier, and return to step 5 while material uncertainty remains.

Done when every factual premise the answers exposed is verified or recorded as an open item, and the recomputed frontier holds no material question; otherwise return to step 5.

### 7. Pass the readiness gate

Invoke `make-it-verifiable` in contract mode on the requirements and acceptance conditions. Run it in a scratch copy outside the repository so the repository stays unchanged. Non-software plans get scripted human or observational checks. The result is the verification contract: one red-capable check per claim, each with a status. A `blocked` row goes back to the grill, where the user accepts it by name or the scope changes.

Finalize only when no unresolved item could materially change scope, approach, sequencing, feasibility, validation, ownership, or risk treatment.

Check:

- Expected outcome: the end state and why it matters are explicit in the conversation, supplied material, or an authoritative source.
- Definition of Done: observable completion evidence and the plan-level acceptance gate are explicit and distinct from task completion.
- Scope: in-scope and out-of-scope boundaries are clear.
- Current state: the relevant starting conditions are understood.
- Prior-art verification: `Context and evidence` satisfies the Verify prior art protocol; unresolved material leads or evidence gaps block dependent decisions.
- Constraints: material technical, organizational, legal, policy, time, cost, compatibility, and resource constraints are known.
- Decisions: major approach choices are settled or intentionally deferred with a resolution path.
- Dependencies: upstream, downstream, external, and approval dependencies are identified.
- Interfaces: handoffs and contracts between workstreams are clear where relevant.
- Validation: the verification contract covers every requirement and has no `blocked` rows.
- Impact and risk: benefits and tradeoffs, inspected blast radius, door classification and recovery limits, and plausible failure scenarios are explicit; material controls map to tasks and unresolved exposure is decided or blocks commitment.
- Ownership: external inputs, approvals, and deferred decisions have owners or resolution sources where ownership matters.
- Execution context: a fresh executor can proceed without rediscovering critical context.
- Skills: planning-time skills were used where needed and execution-time skill handoffs are mapped.
- Skill discovery: the handoff records `COMPLETE`, `INCOMPLETE`, or `SKIPPED: TRIVIAL`, including disciplines, exact searches, candidates, and routing decisions.

Neither item may be deferred. The readiness gate cannot pass while the Expected outcome or Definition of Done is inferred, assumed, deferred, or unresolved.

If the user explicitly forbids questions, run the same grill internally and research everything resolvable. If the Expected outcome or Definition of Done remains unstated, report it as a blocking interaction-dependent uncertainty; do not invent it or finalize the plan. Other non-blocking uncertainties may still be labeled as assumptions under the existing rules. The grill itself is still mandatory.

Done when every check above passes against current evidence.

### 8. Draft the plan

Write the plan as a self-contained execution contract. A fresh executor understands the goal, important constraints, settled decisions, sequencing, and evidence of completion from the plan alone, without the original conversation.

Embed the contract in `## Acceptance criteria` (check column) and `## End-to-end verification`. Make its check artifacts the plan's first task. Each `planned-red` row adds its red-proof step to that task, before any implementation.

Use the plan template in [references/plan-template.md](references/plan-template.md).

Done when every applicable template section is filled from the brief, ledger, and verification contract, and plan task 1 carries the check artifacts.

### 9. Right-size and sequence work items

A work item should usually be the smallest unit that:

- produces a meaningful outcome
- can be validated independently
- has a coherent dependency boundary
- exposes a clear output or interface to dependent work
- could be reviewed, accepted, rolled back, or rejected separately when relevant

Give work items stable IDs and explicit dependencies. Within each engineering work item, provide ordered checkbox steps with concrete implementation and verification detail. For research or review, use evidence-producing stages rather than implementation-style microsteps.

Build the dependency graph before final ordering.

Split the plan when independent subsystems or goals can succeed, fail, ship, or be reviewed separately. If a plan becomes too large for one executor to hold reliably, create subplans and define their contracts explicitly.

Done when every work item has a stable ID, explicit dependencies, and a position the dependency graph justifies.

### 10. Run plan QA and iterate review

Follow `references/quality-gates.md`.

Rerun contract mode on any claim added while drafting; a `blocked` row returns to step 5.

Review the draft as both a skeptical executor and a skeptical approver against Gates 1–10. Also verify:

- factual claims are supported by inspected evidence
- exact names, paths, commands, APIs, owners, dates, and skills are verified rather than guessed
- no placeholder remains that research should have resolved

Apply `keep-it-simple` during this review to remove unnecessary work while preserving decision completeness and every requirement, risk control, validation step, and acceptance condition.

When QA reveals a material gap, return to research and grilling and close it there; a vague TODO leaves it open.

Repeat draft, review, and revision using Gate 11 in `references/quality-gates.md` until the latest complete review of the current plan reports zero actionable comments. Follow its three-round default cap and full-context review rules: review the whole plan until a complete review exists, then focus on revisions since that review and unresolved findings. Optional suggestions may remain; they do not authorize scope expansion. Deliver only after this review gate passes; at the cap without a clean verdict, report incomplete and ask whether to continue.

Done when the latest complete review is clean and no contract row is `blocked`, or the cap is reached and the user has been asked whether to continue.

### 11. Add the one-time star suggestion

Follow the star suggestion protocol in [references/delivery.md](references/delivery.md).

Done when the marker attempt has an outcome and the plan carries the suggestion exactly when that outcome calls for it.

### 12. Deliver the plan

After QA and review iteration pass, deliver the complete plan as [references/delivery.md](references/delivery.md) describes, using the active runtime mode and [host references](references/hosts.md).

Done when the user holds the complete plan through the runtime's delivery surface.

## Skill orchestration

Skill selection is part of planning and execution design. Follow `references/skill-routing.md` for catalog inspection, invocation, re-checks after the grill reveals new domains, tools, artifacts, or risk surfaces, and the mandatory `## Skill handoff`. Treat the plan as invalid until `## Skill handoff` records the discovery status and evidence required by `references/dynamic-skills.md`.
