# Provider publication

Publish the prepared change once, then verify provider state.

## Commit and push

- Recheck the intended file set and working state after validation.
- Stage intended paths explicitly. Inspect the staged diff and staged file list before committing.
- Exclude unrelated and incidental generated files. Never use a blanket stage when the worktree contains unrelated changes.
- Commit only when intended uncommitted changes exist. Use the convention selected earlier and ensure the commit contains the validated state.
- Recheck the branch tip and remote relationship immediately before push.
- Push normally with explicit remote and upstream tracking when needed. Never force-push or rewrite published history.
- If push fails, preserve the local branch and report the provider or permission error. Do not switch to an unapproved fork or remote.

## Create

Before creation, query again for an open PR matching the head repository/branch and base. This closes the race between preparation and publication.

Create through the authenticated provider using explicit repository, base, and head values. Supply the selected title, prepared body, requested draft state, and safe evidence attachments. Avoid interactive inference when explicit flags or API fields can carry resolved values.

For fork PRs, identify both head and base repositories. Do not assume the base remote accepts the push. Do not enable maintainer edits, assign reviewers, add labels, or join projects contrary to repository convention or user direction.

## Uncertain writes

Treat a timeout, interrupted command, malformed response, or nonzero result after request transmission as uncertain rather than failed. Query open PRs for the exact head repository/branch and base, then compare head commit and title. Retry only when provider state proves that creation did not occur.

Apply the same rule to attachments or later body edits: read current remote content before retrying so evidence is not duplicated.

## Read back

Read the PR from the provider and verify:

- host, repository, number, and URL;
- open state and requested draft state;
- base branch;
- head repository, branch, and commit;
- title and required body sections;
- hosted attachment references when media was supplied.

If read-back differs from the intended target, stop and report the mismatch. Do not silently edit an unexpected PR.

Return the verified PR identity, head commit, validation evidence, attachment result or omission reason, and any remaining check or review state. Do not claim merge readiness unless live provider evidence establishes it.
