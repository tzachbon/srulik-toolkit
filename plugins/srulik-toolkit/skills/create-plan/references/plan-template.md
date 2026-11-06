# Plan root structure

Step 8 of the [create-plan workflow](../SKILL.md#8-draft-the-plan).

Use this root structure unless a discipline reference calls for a small adaptation:

```markdown
# <Plan title>

## Objective

<What will be true when the plan succeeds, and why it matters.>

## Definition of Done

<The observable evidence and plan-level acceptance gate that prove the expected outcome was achieved. Do not substitute a list of completed implementation activities.>

## Context and evidence

<Explain the current state and problem mechanism, affected people/systems, evidence, and why the change is needed. Include prior-art verification from step 2, source pointers, and material limits of the evidence.>

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

## Impact and blast radius

<State intended benefits and material costs or tradeoffs. Name affected people, callers, data, systems, or workflows, including indirect effects, with evidence for the boundaries and explicit unknowns.>

## Reversibility and recovery

<Classify consequential decisions or steps as one-way or two-way doors and explain why. Identify commitment points, recovery procedure and prerequisites, and effects recovery cannot undo.>

## Approach

<Explain the proposed state, how the parts interact, why this approach fits the evidence, credible alternatives rejected and their tradeoffs, and the reason for the sequence.>

## Technical / Coding

<Required for every coding plan. For a simple fix, keep this section concise and omit only subsections that add no useful information.>

### High-Level Design

<For a non-simple change, show system or component boundaries and the relevant control or data flow. Invoke `show-me` and include its smallest useful diagram.>

### System APIs

<When applicable, define affected or proposed APIs, schemas, events, commands, compatibility constraints, and error contracts.>

### Low-Level Design

<Describe the implementation flow, module and file responsibilities, key algorithms, and representative code or diff sketches. Use `show-me` to make the intended code shape explicit.>

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

## What can go wrong

| Failure scenario | Consequence | Detection signal | Prevention / task | Stop condition and recovery / task | Residual exposure |
| --- | --- | --- | --- | --- | --- |
| <Plausible trigger and failure> | <Who or what is harmed, and how> | <Observable signal> | <Control and task ID> | <Abort threshold, recovery or its limits, and task ID> | <Remaining risk and acceptance decision when material> |

## Open and deferred items

- <Item> -> <owner/source to resolve it> -> <when it must be resolved> -> <impact if unresolved>

## Skill handoff

- Skill discovery: `COMPLETE` | `INCOMPLETE` | `SKIPPED: TRIVIAL`
- Disciplines and searches: <discipline> -> <installed matches> -> `<exact external query>` -> <result or strict-trivial evidence>
- During planning: <exact skill> -> <what it contributed>
- During execution: <phase/workstream> -> <exact skill> -> <trigger> -> <expected output>
- External candidates and installation: <selected, rejected, loaded, or deferred decision> -> <reason, scope, and agent targets when applicable>

## References

- <source, file, document, issue, URL, decision record, or other evidence>
```

Omit empty sections except `## Technical / Coding` in coding plans. Keep the impact, reversibility, and failure assessment explicit; for bounded low-risk work, short paragraphs may replace the risk table. If no material failure scenario is identified, state that conclusion with its evidence limits. Within the required technical section, simple fixes may omit irrelevant subsections. Add discipline-specific sections when they improve execution. The template is a scaffold: expand each substantive section into explanations, tables, examples, and executable steps as needed. Do not treat its short placeholders as the intended output length.
