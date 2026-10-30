# Authoring a skill

Adapted from Anthropic's skill-creator at
`ca45fc496a3436251f191354091d557da31c15b5`; modified for Srulik handoffs and
portable authoring. See [Apache-2.0 terms](../LICENSE.txt).

Use this reference as design evidence in `create-plan`, then as execution
instructions inside the approved `implement-plan` task. Every creation or edit
needs both handoffs; reading this reference does not authorize a write.

1. Inspect the current conversation, target repository guidance, nearby skills,
   and actual examples. Resolve facts from evidence before asking the user.
   Capture what the skill enables, its trigger, expected artifact, boundaries,
   and independently observable success. Preserve an existing skill's name.
2. Define a concise `name` and discriminating `description`: what it does and
   when it applies. Separate genuine trigger branches from synonyms. Preserve
   invocation policy unless a change is explicitly required. Keep automatic
   discovery enabled by default; sensitivity is handled by execution authority,
   not by silently hiding a skill.
3. Write a capability-based `SKILL.md` with an ordered workflow, completion
   evidence, and important failure/stop conditions. Put substantial branch- or
   host-specific instructions in linked references with explicit reading
   conditions. Resolve relative paths from their owning document, not cwd.
4. Bundle scripts only for repetitive deterministic operations, assets only
   when outputs need them, and examples only when they change interpretation.
   Reuse installed capabilities and native platform features. Explain fragile
   constraints; remove boilerplate, speculative modes, and duplicated rules.
5. Use 2–3 realistic test prompts unless the approved plan chooses another
   justified set. Cover the primary behavior and a meaningful boundary. Share
   the prompts and observable expectations with the fixture owner before runs.
   Subjective quality needs human judgment; do not disguise it as an objective
   pass/fail assertion.
6. Follow [evaluation](evaluation.md), inspect outputs and transcripts, and
   generalize feedback instead of overfitting a single example. If several
   runs independently reinvent the same useful helper, consider bundling it
   within the approved scope. A new uncovered requirement returns to planning.

Minimum package:

```text
skill-name/
  SKILL.md      # name/description frontmatter and instructions
  references/   # only substantial conditional instructions
  scripts/      # only needed deterministic helpers
  assets/       # only resources used in outputs
```

The additional directories are optional. A copied upstream resource retains its
license/notices and a prominent modification notice. Validate authored scripts
through their public interface and the repository's actual check; never claim
that syntax/frontmatter checks prove behavioral quality.
