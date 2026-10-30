---
name: skill-creator
description: Create or edit a skill, improve its instructions or triggers, evaluate it on real tasks, or benchmark a revision. Every skill creation or edit uses create-plan and implement-plan, including small changes; evaluation compares actual outputs and includes human review.
license: Apache-2.0
---

# Skill creator

Adapted from Anthropic's skill-creator; modified for portable execution and
Srulik's mandatory planning, implementation, and review handoffs. Original
terms and copyright are retained in [LICENSE.txt](LICENSE.txt).

## Bind the request

Identify the target skill, requested outcome, scope, output location, existing
instructions, and observable completion evidence. Inspect the target before
editing; preserve an existing name and invocation policy unless the request
changes them. Skill creation, editing, trigger optimization, and feedback-driven
revisions all count as authoring.

Read [authoring guidance](references/authoring.md) for authoring and
[evaluation guidance](references/evaluation.md) for real test runs. Select the
matching [host mapping](references/hosts.md). These mappings name the supported
hosts and concrete tools. On an undocumented
host, show the capability mapping, label it untested, and obtain confirmation
before proceeding. Missing capabilities remain explicit limitations.

## Plan every creation or edit

Invoke `create-plan` for every skill creation or edit, including small changes.
Its output must cover the target, expected behavior, fixtures, acceptance
criteria, baseline, feedback revisions, and validation. Use the references as
design evidence during planning; do not write target skill files then.

Planning alone does not authorize implementation. Obtain the required decisions
and implementation authorization, then invoke `implement-plan` with that plan.
An explicit request to implement an already approved plan supplies that
authorization within its scope.

When executing an already approved authoring task, verify that it covers this
change and consume these references **inside that task**. Do not recursively
restart the top-level skill or ask for an identical plan. Every logical change
still needs an approved plan and execution through `implement-plan`; there is
no small-edit exemption. New requirements or feedback outside the covered
revision return to planning before another edit.

An evaluation-only request that does not change a skill can use the evaluation
reference directly within the request's authority.

## Execute, evaluate, and review

Use `keep-it-simple` before authoring and cleanup. Write only the resources
needed for the agreed behavior. For improvement, preserve an immutable snapshot
before the first target edit. Agree on realistic prompts, expected outputs, and
verifiable expectations before running them.

Execute real target tasks and comparable independent baselines. Respect host
capacity; serial fresh sessions are valid when child concurrency is unavailable.
Grade actual outputs with [grader guidance](agents/grader.md), then aggregate
and inspect [analysis guidance](agents/analyzer.md). Missing runs or evidence
are incomplete, not passes. Never substitute characters for tokens or fabricate
unavailable telemetry.

Generate the bundled static review artifact and present it before revising
from feedback. Distinguish synthetic fixture feedback from human acceptance.
Apply only revisions covered by the approved plan, rerun affected evaluations,
and preserve previous iteration outputs. Stop at the plan's iteration limit;
unsettled scope returns to planning.

Invoke `review-pro-max` on the authored change through `implement-plan` before
delivery. Follow its existing review/fix limits. Publication or installation
outside the approved scope requires separate authority; neither is implied by
authoring or evaluation.

## Completion evidence

Return the skill location and identity, approved plan, produced artifacts,
actual test prompts and outputs, baseline identity, grades and benchmark,
human feedback status, review verdict, and remaining limitations. A plan,
installed indicator, or helper exit status alone does not prove the target
workflow. Report unsupported capabilities honestly; optional optimization must
not block portable authoring or evaluation.
