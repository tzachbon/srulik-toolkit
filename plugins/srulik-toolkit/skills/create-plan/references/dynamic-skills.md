# Optional external skill discovery

Use this reference only when the user asks to search for additional skills. The
normal planning workflow works from installed capabilities and records missing
capabilities without searching a marketplace.

Use the current runtime's skill search or catalog when it exposes one. If an
installed discovery skill applies, follow it. Do not assume a specific CLI,
marketplace, or global configuration exists.

## Discovery boundary

The user's request for discovery authorizes read-only search. Installing,
updating, or removing a skill requires an explicit user request for that change.
A request to create a plan or search for candidates does not authorize
installation.

Never claim that an external candidate was loaded or used. Only load a skill after it is installed and available through the current harness. When installation is not authorized, carry its intended capability into the plan as a proposed handoff or unresolved dependency.

## Find candidates

1. Reduce the capability gap to two or three specific search terms: domain, task, and relevant platform or artifact.
2. Check the installed catalog first. Prefer a specific installed skill when it covers the need.
3. Search the external ecosystem through a capability available in the current
   runtime. A documented marketplace UI, plugin tool, or CLI are all valid; do
   not invent a route the runtime does not expose.
4. Try one focused synonym query when the first search misses. Stop after useful
   coverage; do not turn plan creation into a marketplace survey.

## Qualify before recommending

Do not recommend a candidate from search rank alone. Verify:

- the skill's exact name, package source, purpose, and public installation reference;
- evidence of adoption, including install count when available;
- publisher or repository reputation;
- repository activity and stars when available;
- fit with the exact planning phase or execution workstream;
- conflicts with the user's constraints, the current plan, or installed skills.

Prefer official or established publishers and skills with at least 1,000 installs. Treat fewer than 100 installs or fewer than 100 repository stars as weak evidence, not an automatic rejection. State when quality signals are missing.

## Present and route candidates

Keep the shortlist to three candidates. For each candidate include:

- exact skill and package name;
- the phase where it would be loaded and the output it should produce;
- source, install count, and repository reputation evidence that was verified;
- installation source and the exact command or marketplace action, when the
  current harness documents one;
- status: `installed`, `available but not installed`, or `unverified`.

Recommend loading installed candidates at the relevant phase. For an external candidate, ask whether the user wants it installed only when it materially improves the current planning work or is required before execution. Do not block a usable plan on an optional skill.

After the user explicitly requests installation, use the installation mechanism
documented for the active harness. Verify that a fresh session exposes the skill
before invoking it. If the harness needs a reload, record that prerequisite
instead of claiming the skill is active.

## Plan integration

Record dynamic discovery in `## Skill handoff`:

```markdown
- Installed: `<skill>` -> load during <phase> -> produce <output>.
- Available but not installed: `<owner/repo@skill>` -> install only after an explicit user request -> load during <phase> -> produce <output>.
- Missing capability: <capability> -> no qualified skill found -> executor must handle directly or create a skill if the workflow will recur.
```

If no candidate passes qualification, state that no qualified external skill was found. Continue with general capabilities when the plan remains executable.
