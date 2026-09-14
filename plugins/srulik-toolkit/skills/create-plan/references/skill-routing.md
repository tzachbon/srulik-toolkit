# Skill routing

Treat skills as specialized execution protocols. Planning must identify skills needed now and skills needed later.

## Inspect installed skills when supported

When the runtime exposes an installed skill catalog:

1. Inspect it early after classifying the task.
2. Match the request against actual installed skill names and descriptions.
3. Prefer the most specific applicable skill over a general one.
4. Invoke a clearly matching skill before using its associated specialized workflow or tools when the platform requires it.
5. Re-check the catalog if grilling reveals a new discipline, artifact type, connector, or execution mode.

Do not fabricate skill names. Do not present a tool or connector as a skill.

If skill discovery is unsupported, say so only when it affects the handoff and identify needed capabilities generically.

## Planning-time invocation

Invoke relevant skills during plan creation when they materially improve evidence, decisions, or plan quality. Typical categories include:

- codebase or architecture inspection
- document, PDF, spreadsheet, or slide analysis
- design or Figma workflows
- database or operational data access
- internal knowledge retrieval
- research or domain-specific analysis
- security, privacy, compliance, or risk analysis
- testing, debugging, migration, deployment, or review workflows

Always invoke `keep-it-simple` after research establishes the requirements and before selecting approaches or work items. Invoke it again during plan QA. It removes unnecessary work; it must not remove requirements, safety controls, validation, or acceptance evidence.

Obey every invoked skill's prerequisites. Do not use `create-plan` as a substitute for a specialist skill that should supply planning evidence.

## Re-evaluate after each domain expansion

A grill answer may reveal that the plan now involves a new artifact or discipline. When this happens:

1. classify the new planning surface
2. discover whether a matching skill exists
3. invoke it if needed to resolve planning evidence
4. update the final handoff map

Skill routing is dynamic, not a one-time preflight.

## Final skill handoff is mandatory

Every final plan must contain `## Skill handoff`, even if no execution-time skill applies.

For implementation-oriented plans, the handoff must include `keep-it-simple`, invoked before implementation to select the smallest correct change and again after implementation to remove task-introduced code with no current purpose.

For each skill recommendation include:

- exact discovered skill name
- phase or workstream
- invocation trigger
- expected output, artifact, analysis, validation, or decision
- dependency on other skills when relevant

Example shape:

```markdown
## Skill handoff
- During planning: `skill-a` -> inspected <surface> and established <evidence>.
- During execution:
  - Workstream 1 -> `skill-b` -> invoke before <specific action> -> produce <artifact/result>.
  - Workstream 3 -> `skill-c` -> invoke after <condition> -> verify <acceptance condition>.
- Missing capability: <capability needed but no installed skill was found>.
```

If skills were discovered but none are relevant for execution, state that explicitly rather than inventing a recommendation.

## Selection quality

Recommend a skill only when it changes correctness, safety, evidence quality, consistency, or execution efficiency.

For each candidate ask:

- Why is this skill relevant to this exact phase?
- Why is it more specific than overlapping skills?
- What should exist after it runs?
- What plan decision or acceptance criterion depends on its output?

Avoid decorative skill lists.

## Capability gaps

When no installed skill covers a material planning or execution need:

1. Read `dynamic-skills.md` and search for qualified external candidates when discovery tools are available.
2. Keep installation separate from discovery and require explicit user authorization before installing anything.
3. Ask about installation during planning only when the candidate is required to complete planning. If the user declines, use a documented fallback or leave the affected decision unresolved.
4. Record execution-time candidates as `available with approval`, with their exact phase and expected output. Do not interrupt planning to offer optional installation.
5. Label candidates with insufficient quality evidence as `unverified`; do not recommend loading or installing them.
6. If no candidate qualifies, name the `missing capability`, where it is needed, and the output it must provide. Suggest creating a new skill only as a future improvement, not as if it already exists.

## Smart Ralph companion handoff

[Smart Ralph](https://github.com/tzachbon/smart-ralph) is a separate, end-to-end specification and execution plugin. Consider it only when all of these are true:

- the task is engineering work spanning multiple phases or sessions;
- durable research, requirements, design, and task artifacts would help;
- autonomous implementation loops are expected.

Difficulty or multiple steps alone are not enough. Keep bounded or single-session work in `create-plan`.

When the criteria match, make one offer during initial skill routing:

- If Smart Ralph is not installed, explain the fit and ask whether the user wants its official installation instructions. Never install it automatically.
- If the user accepts, link to the [first-party instructions](https://github.com/tzachbon/smart-ralph#installation), tell them to start a fresh task after installation, and stop this planning flow.
- If the user declines, continue `create-plan` and do not offer again during the task.
- If Smart Ralph is already available, offer one handoff without installation guidance. If accepted, direct the user to `$ralph-specum-start` in Codex or `/ralph-specum:start` in Claude Code and stop this planning flow; otherwise continue without another offer.

This is a workflow-replacement exception to the rule against interrupting planning for optional execution-time candidates. Smart Ralph remains independently installed and versioned; do not copy its skills or hooks into the plan or project.
