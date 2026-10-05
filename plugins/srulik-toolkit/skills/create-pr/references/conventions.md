# Repository conventions

Derive conventions from evidence instead of imposing a preferred house style.

## Evidence order

Use the first source that settles each decision:

1. Repository instructions, contribution docs, PR templates, commit or title linters, CI checks, release rules, and branch protection.
2. A clear repeated pattern across several recent merged PRs from maintainers or code owners.
3. The fallbacks below.

Explicit rules outrank historical practice. A single PR is an example, not a convention. Prefer merged work because it reflects accepted practice; ignore bots, bulk dependency updates, generated releases, and obvious exceptional changes when inferring ordinary authoring style.

Record evidence separately for branch names, commit messages, PR titles, body structure, issue linking, draft status, reviewers, and labels. One observed convention does not establish the others.

## Fallbacks

When repository evidence is insufficient:

- Branch: `<type>/<short-kebab-case-summary>`.
- Commit and PR title: Conventional Commit form, `<type>(optional-scope): <imperative summary>`.
- Use the narrowest accurate type, commonly `feat`, `fix`, `docs`, `test`, `refactor`, `build`, `ci`, or `chore`.
- Keep the summary specific and omit a period.
- Body: `Summary`, `Evidence`, `Merge danger`, and `Blast radius`; add `Why` only when the motivation is not evident. Use the review guidance below to fill them.
- Create a non-draft PR unless the user requested a draft.
- Do not assign reviewers, labels, milestones, or projects without repository evidence or a user request.

## Title and body

Keep both as short as the repository permits. A title names the outcome, not the implementation diary. The body should help a reviewer answer three questions: what changed, why when non-obvious, and what proves it.

When a template exists:

- preserve required headings, checklists, and issue-closing syntax;
- remove untouched instructional comments;
- fill only applicable optional sections;
- mark a checkbox complete only when its condition is true;
- explain a required but inapplicable item briefly instead of falsely checking it.

## Help the reviewer decide

Apply this guidance within the repository's required body structure. Add a missing
section only when the template permits it; otherwise place the information under
the nearest applicable heading.

- **Summary:** describe the concrete trigger and resulting behavior. Invoke
  [show-me](../../show-me/SKILL.md) when a small flow, pseudocode sketch, or diff
  makes the change easier to review. Scale the visual to the change.
- **Evidence:** use the captured [validation evidence](evidence.md). For a behavior
  change, show the same scenario before and after, with exact outcomes and tested
  revisions. Label unavailable baseline evidence and remaining coverage honestly.
- **Merge danger:** state whether this is a two-way door or a one-way door and why.
  A code revert may not undo deleted data, migrations, public actions, or external
  side effects. Describe recovery prerequisites when they matter; do not run a
  deployment or destructive action just to prove reversibility.
- **Blast radius:** name the affected callers, users, data, or services and the
  boundaries supported by inspection or checks. Explain a risk that changes the
  review decision; avoid unsupported claims that a change is safe or isolated.

Do not repeat the title, list every changed file, narrate routine commands, add generic benefits, or claim safety, completeness, performance, or compatibility without evidence. Link an issue only when the relationship is verified. Use closing keywords only when merge should close that issue.

The convention gate passes when every outbound naming and description choice has a cited repository source or an explicit fallback.
