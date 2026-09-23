# Dynamic skill discovery

External discovery is mandatory for every non-trivial plan. Inspect installed skills first, but do not use an installed match as a reason to skip external discovery. Discovery is an evidence-gathering step; it does not require loading, recommending, or installing anything.

This reference embeds the relevant discovery behavior from `find-skills` so `create-plan` remains self-contained. It does not require `find-skills` to be installed or loaded.

## Discovery boundary

Skill search is read-only. Search and recommend without asking for permission. Installing, updating, or removing a skill changes the user's environment and requires explicit user authorization. A request to create a plan does not authorize installation.

Loading a discovered skill is optional. Never claim that an external candidate was loaded or used. Load a skill only after installation succeeds and the current harness exposes it, and only when it materially improves the current planning work. When installation is not authorized, carry its intended capability into the plan as a proposed handoff, documented fallback, or unresolved dependency.

## Confidentiality boundary

Redact or generalize confidential terms before external skill discovery. Never send secrets, credentials, private paths, proprietary code or requirements, customer names, internal identifiers, or other confidential context to an external search. Use generic capability terms that preserve the planning question. If safe generalization is not possible for useful discovery, do not transmit the context; record Skill discovery: `INCOMPLETE` and the omitted context category.

## Strict-trivial exception

Skip external search only when all of these conditions are evidenced:

1. The plan has exactly one material discipline.
2. It contains one bounded work item.
3. Its effects are low risk and reversible.
4. It touches no external system and includes no migration.
5. No specialist capability would materially improve correctness or validation.

If any condition is false or uncertain, the plan is non-trivial and external discovery is mandatory. Installed catalog inspection still applies when the exception passes. Record Skill discovery: `SKIPPED: TRIVIAL` and the evidence for each condition in `## Skill handoff`.

## Find candidates

1. Classify the plan's material disciplines or workstreams.
2. Inspect the installed catalog for each discipline and record exact matches.
3. Unless the strict-trivial exception passes, derive two or three specific search terms for each discipline: domain, task, and relevant platform or artifact.
4. Run one focused external search per material discipline with:

   ```bash
   npx skills find <specific query>
   ```

   Use `--owner <owner>` only when the task or evidence identifies a trusted source.
5. Try one focused synonym query only when the first result is weak or inconclusive. Stop after that retry; do not turn plan creation into a marketplace survey.

Record each exact query and its result. A successful search may conclude that no candidate qualifies. If search is unavailable or remains inconclusive after the retry, continue planning but record Skill discovery: `INCOMPLETE` and do not claim complete skill coverage.

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

Load installed candidates at the relevant phase only when they materially improve the work. Discovery alone does not require loading.

After the Expected outcome and Definition of Done are explicit, ask about a planning-critical candidate in the next eligible grilling wave. Ask about execution-only candidates during the execution-and-closure wave. If the user declines, continue with a documented fallback when one exists; otherwise leave the affected decision unresolved. Do not recommend loading an `unverified` candidate.

When the user selects installation, ask next about project or global scope and which CLI-detected agents should receive the skill. Record the matching CLI-native action in the execution plan; `create-plan` does not execute it and does not force `.agents/skills` or another directory:

```bash
npx skills add <owner/repo@skill> --agent <agent> -y
npx skills add <owner/repo@skill> --global --agent <agent> -y
```

After installation, verify that the current harness exposes the skill before invoking it. If the harness needs a new session or reload, record that prerequisite instead of claiming the skill is active.

## Plan integration

Treat the plan as invalid until `## Skill handoff` records the status, evidence, and routing decisions:

```markdown
- Skill discovery: `COMPLETE` | `INCOMPLETE` | `SKIPPED: TRIVIAL`.
- Disciplines and searches: <discipline> -> `<exact query>` -> <result>; include the synonym retry when used.
- Installed candidates: `<skill>` -> selected, loaded, rejected, or deferred -> <reason and phase>.
- External candidates: `<owner/repo@skill>` -> qualified, unverified, rejected, or deferred -> <evidence and reason>.
- Installation decision: <not requested, declined, or selected for execution> -> <scope and CLI-detected agent targets when selected>.
```

Use `COMPLETE` when every required discipline received a successful search and qualification pass, including a defensible no-match result. Use `INCOMPLETE` when a search could not run or remained inconclusive. Use `SKIPPED: TRIVIAL` only when every strict-trivial condition is evidenced. If no candidate passes qualification, state that no qualified external skill was found and continue with general capabilities when the plan remains executable.
