# Detailed plan authoring

Read this reference before drafting or revising a final plan. Apply the depth standard to engineering, architecture, research, review, migration, operations, and strategy. Adapt the evidence and artifacts to the discipline.

## Contents

- Depth and structure
- Context, requirements, and design
- Execution detail
- Engineering specificity
- Nonengineering specificity
- Uncertainty and checkpoints
- Calibration examples
- Final depth check

## Depth and structure

Write for a skilled executor who has not seen the conversation and does not know the project's conventions. Give enough explanation to understand the problem and enough instruction to carry out the settled approach. A short objective and overview help navigation; follow them with the full reasoning and task detail.

Use headings, tables, numbered tasks, and checkboxes to make a long plan usable. Do not impose a word count or pad small tasks. Expand where an omission would force another investigation, decision, or clarification. Keep precise language and remove generic advice even in a long document.

Keep one plan by default. Split into linked subplans only when independent workstreams or document size warrant it. Include shared constraints in the parent and repeat the critical subset in each independently consumed subplan. Name what each subplan consumes, produces, and must verify before integration. Do not create a spec framework or state machinery just to produce a detailed document.

## Context, requirements, and design

Explain the relevant starting state: existing behavior, its limitation, affected users or systems, and the evidence supporting the proposed change. Define unfamiliar domain terms. Distinguish observed behavior from desired behavior. Record evidence limits and contradictions that affect the approach.

Give material requirements stable IDs. For each, state the expected behavior or outcome, its source, and acceptance conditions. Include concrete scenarios when they clarify ambiguity. Include performance, compatibility, accessibility, operational, or other nonfunctional constraints only when relevant, with thresholds taken from evidence or an explicit decision.

Explain the proposed design or delivery method in enough depth to expose the decisions:

- Responsibilities of each component, workstream, or artifact.
- Control, data, evidence, or decision flow across boundaries.
- Inputs and outputs, including error or rejection behavior.
- Chosen approach, credible alternatives, and the reasons for the choice.
- Constraints that apply across tasks and where they will be verified.

An artifact map should identify the target, whether it exists or is proposed, the action, and its responsibility. Existing paths, commands, APIs, and signatures require inspection. A new path or interface may be a proposed design choice; label it as proposed and check that it fits existing conventions. Do not describe it as already present.

## Execution detail

Give every task an independently acceptable outcome and stable identifier. Include:

1. **Why and what:** the requirement IDs, purpose, intended result, and relevant local context.
2. **Before starting:** dependencies, source material, environment or access prerequisites, exact target artifacts, and constraints.
3. **How:** ordered checkbox steps, one bounded action per step, with concrete method, content, and expected intermediate results.
4. **Done when:** observable acceptance conditions, verification procedure, expected results, and evidence to retain.
5. **If it fails and what follows:** material failure signals, recovery or stop instructions, downstream output contracts, and applicable skill handoffs.

Expand each step enough to answer how to perform it. “Add validation,” “handle edge cases,” “research options,” “test thoroughly,” and “update documentation” are incomplete without the rules, cases, method, or content involved. Include specific failure cases and handling where they can invalidate the outcome.

Distinguish task completion from end-to-end success. After local task checks, include an integration or final verification task that proves the complete requested behavior or conclusion. Specify the starting conditions, procedure, observable result, retained evidence, and response to failure.

## Engineering specificity

Name create/modify/test/configuration targets and their responsibilities. Use symbol names or stable regions when line numbers would become stale. State consumed and produced interfaces with exact names and types where the design requires them; check consistency across tasks.

For code changes, include concrete code, a patch sketch, or a precise algorithm when it settles non-obvious behavior. Include representative test code or explicit input/action/expected-output cases. Complete code is useful for small, settled changes; do not copy entire unchanged files or fabricate implementation details to appear thorough. Label proposed code and distinguish tested snippets from unexecuted examples.

When TDD fits the repository and change, spell out the failing test, focused command, expected failure reason, minimal implementation, and expected passing result. A red test should fail because the target behavior is missing, not because the test environment is broken. For other validation strategies, provide an equally concrete procedure appropriate to the change.

For each command, specify the working directory, prerequisites, expected status or output, and what the result proves. Verify command syntax against inspected project scripts or documentation. Distinguish a command inspected during planning from a command actually run. Do not run state-changing execution commands merely to validate a plan.

Avoid automatic commit steps, fixed minute estimates, or mandatory execution frameworks. Follow the user's instructions and project conventions for commits, review, isolation, resource limits, and deployment authority.

## Nonengineering specificity

Use the same execution standard with discipline-native methods:

- **Research:** question or hypothesis, source-selection criteria, extraction fields, comparison method, treatment of conflicting evidence, stopping rule, and output format.
- **Review:** exact scope and exclusions, evaluation criteria, evidence collection, finding severity and proof requirements, reporting format, and acceptance gate.
- **Architecture or strategy:** decision drivers, credible options, tradeoff method, boundary contracts, evidence that would change the recommendation, and decision authority when known.
- **Migration or operations:** starting-state checks, target-state checks, sequencing and coexistence, rehearsal, cutover preconditions, abort signals, recovery, and final reconciliation.

Do not turn these plans into software test cycles. Make their methods and evidence as specific as engineering steps.

## Uncertainty and checkpoints

Research details that can be resolved now. An execution-time discovery step is appropriate only when the evidence cannot be obtained during planning or intentionally depends on an earlier deliverable. State the precise question, method or source, expected output, completion criterion, and which dependent work must wait. An unresolved choice that can change plan shape still fails the readiness gate.

Put a feasibility experiment early when it resolves a consequential uncertainty. Define the hypothesis, bounded method, pass/fail evidence, and branch taken for each outcome. Do not require a prototype for every plan.

Mark tasks as parallel-safe only when their inputs exist, writes do not conflict, and contracts are settled. Name the integration checkpoint. Place validation at meaningful dependency boundaries; do not impose an arbitrary checkpoint cadence.

## Calibration examples

These examples are fictional teaching cases, not verified repository facts or ready-to-run commands. Replace example details with inspected evidence when authoring a real plan.

### Engineering: explicit input validation

Weak instruction: “Validate pagination and add tests.”

Detailed instruction for a hypothetical confirmed contract:

**Requirement R1:** A missing limit uses 20. An integer from 1 through 100 is valid. Any other supplied value produces HTTP 400 without querying storage.

**Task T1: enforce the limit contract at the request boundary.** Modify the inspected request parser and its existing test target. Keep the response format and storage interface unchanged. The task consumes the raw optional query value and produces either a valid integer or the existing request-validation error.

- [ ] Add table-driven cases for missing input, `1`, `100`, `0`, `101`, `1.5`, and `abc`. Expect 20 for missing input, boundary values unchanged, and the request-validation error for invalid input. Assert that storage is not called for rejected requests.
- [ ] Run the inspected focused test command. The new rejection cases must fail because the parser currently accepts invalid input; diagnose environment failures before interpreting the result.
- [ ] Parse a supplied value, reject non-integers and values outside the allowed range, and apply the default only when the value is absent. Use the existing error mapping so rejected input becomes HTTP 400.
- [ ] Repeat the focused test and relevant request-level check. Retain the command, status, and covered cases as completion evidence.

**Completion:** All R1 cases pass and valid requests still reach storage with the expected integer. A failure in existing valid-request coverage blocks downstream work; correct the parser before proceeding.

A real plan supplies the verified parser/test paths, command, and error interface in place of the example's descriptive targets.

### Research: compare two operating approaches

Weak instruction: “Research both options and recommend one.”

Detailed instruction for a hypothetical investigation:

**Task T2: compare approaches against the agreed decision criteria.** Read each option's primary operating documentation and the relevant internal constraints. Produce one comparison table with criterion, source claim, source location, evidence date, limitation, and implication for the choice.

- [ ] Extract each option's behavior for the agreed criteria. Separate documented capabilities from inferred capabilities and missing evidence.
- [ ] For each material contradiction, inspect the primary source or run an authorized bounded check. Record unresolved contradictions rather than treating missing evidence as proof that a capability is absent.
- [ ] Apply the agreed decision rule. Explain which criterion determines the recommendation and what additional evidence could reverse it.
- [ ] Verify that every conclusion traces to a table row and every criterion has evidence or an explicit limitation. Stop broad research once remaining gaps cannot change the choice; if they can, identify the precise evidence needed before a decision.

**Completion:** The decision maker can compare both options against the same criteria, verify each claim, and see any remaining decision-blocking uncertainty.

## Final depth check

Read each task as if it were the only task handed to a new executor, together with its declared shared context. Can they identify the target, intended behavior, steps, constraints, expected evidence, failure response, and downstream contract? Fill gaps before delivery.

Check the requirement-to-task-to-verification table in both directions. Check interface names, paths, terminology, and acceptance thresholds across sections. Preserve meaningful reasoning when removing filler. A longer outline with the same missing decisions does not pass.
