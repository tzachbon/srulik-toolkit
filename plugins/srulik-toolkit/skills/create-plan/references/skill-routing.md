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

When no installed skill covers a material execution need:

1. Name the missing capability, where it is needed, and the output it must
   provide. Continue with the runtime's general capabilities when they can still
   produce the required outcome.
2. Read `dynamic-skills.md` and search for qualified external candidates only
   when the user requests external discovery.
3. Keep installation separate from discovery. Install only after an explicit
   user request.
4. If the user requested external discovery and a qualified candidate exists,
   record it as `available by explicit installation request`, with its exact
   phase and expected output.
5. If no candidate qualifies, retain the missing capability in the plan. Suggest creating a
   new skill only as a future improvement, not as if it already exists.
