# Dynamic skill discovery

Use this reference only when the installed catalog lacks a material planning or execution capability. Do not run external discovery for decorative recommendations or capabilities the current agent already handles well.

This reference embeds the relevant discovery behavior from `find-skills` so `create-plan` remains self-contained. It does not require `find-skills` to be installed or loaded.

## Discovery boundary

Skill search is read-only. Search and recommend without asking for permission. Installing, updating, or removing a skill changes the user's environment and requires explicit user authorization. A request to create a plan does not authorize installation.

Never claim that an external candidate was loaded or used. Load a skill only after installation succeeds and the current harness exposes it. When installation is not authorized, carry its intended capability into the plan as a proposed handoff, documented fallback, or unresolved dependency.

## Find candidates

1. Reduce the capability gap to two or three specific search terms: domain, task, and relevant platform or artifact.
2. Confirm that the installed catalog has no suitable match. If it does, stop external discovery and load the installed skill at the relevant phase.
3. If the gap remains and web access is available, inspect the skills.sh leaderboard for established candidates.
4. Search the open ecosystem with:

   ```bash
   npx skills find <specific query>
   ```

   Use `--owner <owner>` only when the task or evidence identifies a trusted source.
5. Try one focused synonym query when the first search misses. Stop after useful coverage; do not turn plan creation into a marketplace survey.

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

Keep the shortlist to three candidates. Classify each candidate as:

- `installed`: available in the current harness and ready to load;
- `available with approval`: qualified but installation requires user authorization;
- `unverified`: relevant, but quality evidence is missing or weak;
- `missing capability`: no suitable candidate was found.

For each candidate include:

- exact skill and package name;
- the phase where it would be loaded and the output it should produce;
- source, install count, and repository reputation evidence that was verified;
- installation command and skills.sh link;
- its status.

Load installed candidates at the relevant phase when they materially improve the work. Ask whether the user wants an external candidate installed during planning only when that skill is required to finish the plan. If the user declines, continue with a documented fallback when one exists; otherwise leave the affected decision unresolved.

For execution-time candidates, finish the plan and list them as `available with approval` in `## Skill handoff`. Do not interrupt planning to offer optional installation. Do not recommend loading an `unverified` candidate.

Use this installation command only after the user authorizes it:

```bash
npx skills add <owner/repo@skill> -g -y
```

After installation, verify that the current harness exposes the skill before invoking it. If the harness needs a new session or reload, record that prerequisite instead of claiming the skill is active.

## Plan integration

Record dynamic discovery in `## Skill handoff`:

```markdown
- Installed: `<skill>` -> load during <phase> -> produce <output>.
- Available with approval: `<owner/repo@skill>` -> install only after authorization -> load during <phase> -> produce <output>.
- Unverified: `<owner/repo@skill>` -> missing <quality evidence> -> do not recommend installation.
- Missing capability: <capability> -> no qualified skill found -> executor must handle directly or create a skill if the workflow will recur.
```

If no candidate passes qualification, state that no qualified external skill was found. Continue with general capabilities when the plan remains executable.
