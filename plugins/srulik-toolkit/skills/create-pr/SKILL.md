---
name: create-pr
description: Create a pull request for the current changes.
---

# Create a pull request

Invocation authorizes a branch for the intended changes, project validation, a commit, a normal push, and pull request creation. Honor narrower user limits. Never force-push, merge, enable auto-merge, weaken checks, publish sensitive content, or include unrelated changes.

Follow this sequence:

1. Read [preparation and safety](references/preparation.md). Stop if its readiness gate does not pass.
2. Read [repository conventions](references/conventions.md). Record the chosen base, branch, commit, title, and body conventions.
3. Read [validation and evidence](references/evidence.md). Complete validation and prepare truthful evidence before publishing.
4. Read [provider publication](references/publishing.md). Commit and publish only after the earlier gates pass.

If an existing PR is found during preparation, skip creation and use the read-back procedure in the publication reference. If any write has an uncertain result, inspect provider state before retrying.

Finish only with the provider-verified PR identity, head commit, validation evidence, and any explicit limitation.
