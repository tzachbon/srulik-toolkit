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

Use a pre-mortem for material risk:

1. Assume the plan failed.
2. Identify the most plausible causes.
3. Determine which causes need prevention, detection, recovery, stop conditions, or explicit acceptance.
4. Place those controls in the workstream where they operate, not only in a detached risk list.

High-risk or irreversible steps need stronger evidence and explicit abort/recovery logic.

## Gate 7: assumption pressure test

List assumptions that remain. For each:

- impact if false
- evidence already available
- whether research can resolve it
- whether the user must decide
- latest safe point to resolve it

A material assumption that can still change plan shape means the readiness gate has not passed.

## Gate 8: skill handoff quality

For each recommended skill verify:

- exact installed skill name was discovered
- the skill is relevant to a concrete phase
- invocation timing is explicit
- expected output, artifact, validation, or decision is explicit
- no more specific skill is available

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
