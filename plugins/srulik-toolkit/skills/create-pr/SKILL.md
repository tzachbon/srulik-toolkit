---
name: create-pr
description: Create a pull request for the current changes.
---

# Create a pull request

Invocation authorizes a branch for the intended changes, project validation, a commit, a normal push, and pull request creation. Honor narrower user limits. Never force-push, merge, enable auto-merge, weaken checks, publish sensitive content, or include unrelated changes.

## Establish the change

Read repository instructions and inspect the worktree, staged and unstaged changes, current branch, active Git operations, remotes, default base, provider authentication, and any open PR for the intended head and base. Resolve the repository and provider explicitly; account for forks and enterprise hosts.

If the intended PR already exists, read it from the provider and return its repository, number or URL, base, head, and head commit without committing, pushing, or creating another PR.

Stop and ask when the intended scope or base remains ambiguous, unrelated work cannot be isolated, sensitive content may be published, an active Git operation exists, or required permission is unavailable. Preserve local work. For a detached HEAD with a clear intended change, create a descriptive branch at the current commit.

## Follow local convention

Discover branch, commit, title, and body conventions in this order:

1. Repository instructions, pull request templates, linters, and required checks.
2. A clear repeated pattern across several recent merged pull requests from maintainers or code owners.
3. A Conventional Commit title and commit, plus a `<type>/<slug>` branch.

Explicit rules win over history. Do not treat one pull request as a convention. Keep the title and body as short as the repository permits. Preserve required template sections, remove untouched template comments, and state only the change, its non-obvious reason, and evidence actually collected. Without a template, use `Summary` and `Validation`; add `Why` only when the reason is not evident.

## Validate and publish

Discover and run the repository's required validation plus the smallest check that proves the change. Stop on failure. Stage only intended files, inspect the staged diff, and commit it using the discovered convention when a commit is needed.

Push normally with upstream tracking. Create a non-draft pull request unless the user requested a draft. Pass explicit repository, base, and head values to the authenticated provider.

Prefer concrete evidence over claims. For visual or rendered changes, attach an image or video when it safely demonstrates the result. For other changes, attach media only when it proves success better than text. Inspect every attachment for credentials, private data, unintended windows, usernames, and private paths.

With GitHub CLI, detect attachment support from command help. When supported, use repeatable `gh pr create --attach '<path>#<meaningful alt text>'`; a body reference to the local path may control placement. Accept PNG, JPEG, GIF, WebP, SVG, MP4, MOV, or WebM within provider limits. If the command, permission, or host cannot upload media, continue with textual evidence and report the limitation. Never add decorative evidence.

After creation, read the pull request back from the provider and verify its URL or number, state, base, head repository and branch, title, body, head commit, and uploaded media references when used. If a write fails or its result is uncertain, query for the matching pull request before retrying. Report only the verified identity and validation evidence.
