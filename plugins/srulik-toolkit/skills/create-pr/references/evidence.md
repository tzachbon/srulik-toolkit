# Validation and evidence

Collect evidence before committing or publishing. Evidence proves the current intended state, not an earlier revision.

## Validation

- Discover required commands from repository instructions, CI configuration, package scripts, build files, and changed-surface documentation.
- Inspect commands before running them. Do not use fixers, snapshot updates, code generation, deployments, or other state-changing checks unless they are ordinary authorized implementation steps.
- Run repository-required pre-PR checks plus the smallest focused check that proves the changed behavior.
- After checks, inspect the worktree again. Classify generated changes and exclude or stop on anything unexpected.
- Record the exact command, exit status, relevant outcome, and tested state. A passing unrelated suite is not evidence for the changed behavior.
- Stop on a required or relevant failure. Report infrastructure or missing-tool failures distinctly from product failures.

## Evidence selection

Prefer the cheapest artifact that lets a reviewer verify success:

1. Focused test or assertion output.
2. Required validation and static checks.
3. Before/after metrics or structured output.
4. Image or video for visual, rendered, interaction, or otherwise materially clearer results.

For frontend or rendered changes, include visual evidence when it can be produced safely and demonstrates the changed state. For non-visual changes, use media only when it communicates proof better than text. Never create a decorative terminal screenshot or other quota-filling artifact.

## Attachment safety

Before upload, inspect the actual media at full resolution and check for credentials, tokens, customer or personal data, internal hostnames, private paths, usernames, unrelated applications, notifications, browser tabs, and unintended screen regions. Use meaningful alt text that states what the evidence shows.

For GitHub CLI:

- detect `--attach` from the installed command's help instead of assuming a version;
- supported formats are PNG, JPEG, GIF, WebP, SVG, MP4, MOV, and WebM, subject to live provider limits;
- quote `'<path>#<alt text>'` so the shell does not treat `#` as a comment;
- repeat `--attach` for multiple files;
- reference the local path in body Markdown when placement matters; `gh` rewrites it to the hosted URL;
- treat GitHub Enterprise Server and insufficient write permission as potentially unsupported even when local help lists the flag.

If attachment support, permission, host support, or safe media is unavailable, continue with textual evidence and report why media was omitted. An attachment failure does not justify retrying PR creation blindly.

The evidence gate passes when required checks succeed and every PR claim maps to captured evidence from the state being published.
