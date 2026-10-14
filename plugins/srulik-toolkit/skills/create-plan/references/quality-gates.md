# Plan quality gates

## Contents

- Outcome coverage
- Dependency integrity
- Executable specificity
- Decision integrity
- Validation quality
- Risk and recovery
- Assumption pressure test
- Skill handoff quality
- Detail without filler
- Final adversarial read
- Review iteration

Use these gates before finalizing any plan. The goal is to detect plans that sound complete but still force the executor to rediscover requirements, sequencing, decisions, or validation.

## Gate 1: outcome coverage

Include a coverage map in the final plan:

```text
Requirement/outcome | Plan workstream | Validation evidence | Status
```

Every material requirement must map to work and validation. Mark anything intentionally excluded.

Fail the gate when:

- a requirement has no workstream
- a workstream exists without a clear requirement, outcome, or risk rationale
- acceptance criteria merely restate tasks

## Gate 2: dependency integrity

For every workstream, check:

- required inputs exist before work starts
- produced outputs are named where downstream work depends on them
- approvals and external inputs occur before dependent decisions
- migration/cutover steps respect coexistence and compatibility requirements
- validation happens at the earliest useful boundary

Fail the gate when the order is only narrative or chronological without dependency reasoning.

## Gate 3: executable specificity

A capable fresh executor should know:

- what outcome to produce
- what evidence or artifacts to inspect first
- what constraints must not be violated
- which systems, files, interfaces, stakeholders, or datasets are involved when known
- how to prove the outcome is complete
- what to do if a high-risk step fails

Fail the gate if the executor must rediscover any of these before starting.

Do not fabricate specificity. Unknown-but-required detail becomes an explicit discovery step or deferred decision with a resolution point.

## Gate 4: decision integrity

Inspect every major choice:

- Is the decision actually settled?
- What evidence or user judgment supports it?
- Were credible alternatives considered when a real choice existed?
- Is a supposedly final decision actually contingent on an unresolved fact?
- Is the decision reversible? If not, was the commitment threshold high enough?

Fail the gate if the plan embeds an unstated architectural, strategic, product, policy, or operational decision.

## Gate 5: validation quality

Validation must prove outcomes rather than effort.

Weak:

- review the result
- ensure it works
- test thoroughly
- monitor after launch

Strong validation specifies observable evidence, threshold, reviewer, test, metric, comparison, artifact, or acceptance condition appropriate to the domain.

For every major workstream ask: "What evidence could convince a skeptical reviewer this outcome is complete?"

## Gate 6: risk and recovery

Check the impact and risk assessment defined in the planning brief:

- intended benefits and material costs or tradeoffs have evidence or labeled uncertainty
- the blast radius includes indirect dependencies, with supported boundaries and explicit unknowns
- consequential steps have a justified one-way or two-way door classification, commitment points, and recovery prerequisites and limits

Use the `What can go wrong` section as a pre-mortem for material risk:

1. Assume the plan failed.
2. Identify the most plausible causes.
3. Describe consequences, detection signals, prevention, stop conditions, recovery limits, and residual exposure for each material scenario.
4. Trace controls to executable tasks, and check that unresolved material exposure has an explicit acceptance decision or blocks commitment.

Fail the gate when a rollback claim ignores persistent or external effects, the blast radius is asserted from diff size alone, or a material scenario has no operational response. High-risk or irreversible steps need stronger evidence and explicit abort/recovery logic; unavailable recovery must be stated honestly.

## Gate 7: assumption pressure test

List assumptions that remain. For each:

- impact if false
- evidence already available
- whether research can resolve it
- whether the user must decide
- latest safe point to resolve it

A material assumption that can still change plan shape means the readiness gate has not passed.

## Gate 8: skill handoff quality

At the plan level verify:

- discovery status is `COMPLETE`, `INCOMPLETE`, or `SKIPPED: TRIVIAL`
- every material discipline has installed-catalog evidence and an exact external query and result, or all strict-trivial conditions are evidenced
- unavailable or inconclusive searches are marked `INCOMPLETE` without a complete-coverage claim

For each recommended skill additionally verify:

- exact installed skill name was discovered
- the skill is relevant to a concrete phase
- invocation timing is explicit
- expected output, artifact, validation, or decision is explicit
- no more specific skill is available
- loading and installation decisions are explicit, and discovery alone did not trigger either action

If a capability is useful but no skill exists, label it as a missing capability.

## Gate 9: detail without filler

Do not optimize for brevity. Fail the gate if the draft is only an outline, if task bullets hide necessary decisions, or if a source link substitutes for required execution context.

Remove:

- duplicate steps
- generic project-management filler
- context that does not affect execution
- speculative details unsupported by evidence
- decorative risk or quality sections
- separate tasks for setup/docs/tests when they belong inside a deliverable

Preserve explanations of current and intended behavior, decision rationale, concrete examples, task instructions, failure behavior, and verification procedures. Repeat critical contracts inside independently delegated tasks when needed. Preserve information needed for correct execution even if it repeats an upstream requirements artifact. The final plan must be self-contained.

## Gate 10: final adversarial read

Read the plan from two roles:

### Fresh executor

Ask:

- Where would I stop and ask for missing context?
- What could I implement in two incompatible ways?
- Which dependency or interface is implicit?
- Which validation instruction is non-operational?

### Skeptical approver

Ask:

- What important outcome is not covered?
- Which assumption has escaped scrutiny?
- What failure mode lacks detection or recovery?
- What irreversible choice has weak evidence?
- What work adds cost without moving an outcome?

If either role finds a material gap, re-enter research and grilling.

## Gate 11: review iteration

Repeat draft, review, and revision before delivering the plan:

Choose reviewers using [agent-swarm's model selection](../../agent-swarm/SKILL.md#model-selection): assess task complexity and consequences, then remaining usage and cost. Apply it again when findings change the difficulty or quota changes.

Use a default cap of three review rounds per invocation; a user-specified cap must be a positive whole number. Record the cap and count every launched review attempt, including failed, stale, or timed-out attempts. Preserve the count across resumes; fixes do not reset it. At the cap without a clean verdict, stop, report incomplete with remaining findings and unreviewed changes, and ask whether to continue. Only explicit user continuation grants another budget; retain prior evidence.

1. Pin the current plan revision and the last complete reviewed revision, if one exists. Give a read-only reviewer the complete plan, agreed outcome and scope, acceptance criteria, relevant evidence, and prior comments with their dispositions. Use an independent reviewer when available; otherwise perform a fresh self-review and disclose that limit. Until a complete review exists, review the whole current plan against Gates 1–10. In later rounds, focus on changes since the last complete review and unresolved findings while checking the full plan, dependencies, and acceptance criteria for their effects. Broaden back to a full review when changes invalidate earlier coverage. A focused round is complete only when it covers those changes, their wider effects, and every unresolved actionable comment.
2. Separate actionable comments from optional suggestions. Track each actionable comment and its resolution. Revise the plan for supported in-scope findings; give evidence for disputed findings and carry that response into the next review. A broader proposal stays separate and requires user authority before expanding scope. An out-of-scope defect that prevents the agreed outcome is a blocker, not an optional suggestion.
3. Re-run affected quality gates after fixes. Return to research and grilling when findings expose missing facts or consequential decisions. Request another review within the remaining cap using the coverage rules above, carrying prior comments and responses forward; checking only the old comments is insufficient.
4. Continue until the latest complete review of the current plan reports zero actionable comments. Optional suggestions may remain and do not authorize extra work. Retain the reviewed revision, round count, comment dispositions, final verdict, and remaining suggestions with the planning evidence.

A timeout, failed or stale review, unresolved disagreement, missing authority, or stalled loop is incomplete coverage, never a clean pass. Report the blocker and remaining comments instead of claiming completion. A round limit is not a passing criterion. Substantive edits after a clean review require another review.
