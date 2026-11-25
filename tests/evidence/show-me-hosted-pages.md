# show-me hosted pages evidence

Status: authored, validated, independently reviewed once, and exercised live on
Claude Code (desktop app and CLI). The no-hosted-page path on Codex and the
tour path were not exercised live (see Gaps).

## Change

- `show-me/SKILL.md`: when a host reference documents a host-native private,
  shareable hosted page, publish the HTML there and give the link. A revision
  of a visual already published in the conversation updates that page. No
  publish when the user asked for the file itself. A host with its own hosted
  page but no reference gets the untested-mapping confirmation from
  `CODING_STANDARDS.md`. Otherwise, or when publishing fails, the existing
  viewer / OS opener / path fallback applies.
- `show-me/references/claude-code.md` (new): maps the hosted page to the
  `Artifact` tool and `artifact-design`. It covers the scratchpad-only file
  location, a plain untyped page (no `quickstart` or Artifact types), updating
  by the same `file_path`, native Mermaid rendering (no script import), no web
  fonts or CDN scripts when the caller forbids remote resources, and privacy
  limits.
- `tour/SKILL.md`: when show-me publishes, show-me's host reference chooses the
  file location and tour uses the link. Otherwise tour's temporary-path rule
  applies as before.
- Version `1.33.0` -> `1.34.0` (rebased on #116, which took 1.32.0).

## Source and checks

- Base: `fe657b3` (`origin/main`).
- `./scripts/validate.sh`, `git diff --check` and
  `scripts/check-version-bump.sh fe657b3`: passed on macOS.
- New contract lines in `scripts/validate/20_show_me.py` and
  `scripts/validate/5_stop_hook_files.py`. Before the skill edits, the first
  checks failed (red). Each new contract phrase was then removed once on
  purpose, and validation rejected every one:
  - core: the hosted-page rule, the revise-and-update rule, the
    file-itself exception, the untested-host confirmation, the
    "or when publishing fails" fallback, the host-references link;
  - core: putting the `Artifact` tool name in it;
  - reference: `artifact-design` (every mention), same `file_path`, the
    Mermaid-import rule, the refusal fallback, the no-scratchpad fallback,
    the untyped-page rule, the remote-resources rule, "do not also open the
    local file", the impersonation rule, the observation line;
  - deleting the reference file;
  - tour: the hosted-page sentence.

## Live runs

| Run | Host | Prompt | Observed |
| --- | --- | --- | --- |
| A6 | Claude Code, desktop app (Code tab), macOS, 2026-11-24 | Follow show-me for "where show-me's HTML ends up"; focused HTML | Loaded `artifact-design`, wrote the page in the session scratchpad, published a private Artifact and returned its link (version 1). A follow-up revision republished the same `file_path`: same URL, version 2. |
| A7a | Claude Code CLI 2.1.323, headless `claude -p`, macOS, 2026-11-24 | "List whether a tool named Artifact is available; then follow show-me; compare the login screen before and after moving 'Forgot password' under the password field; focused HTML; state the delivery route" | Reported the `Artifact` tool as available and attempted to publish. The headless run had no approval for it, so it opened the local file and reported "the skill's local-open fallback (OS opener), because the Artifact publish wasn't approved". |

Runs A6 and A7a used the first revision of the text (`b84eede`). The review
fixes after them changed the conditions (documented host-native page, revision
instead of topic, file-itself exception, scratchpad-only, untyped page) but
not the publish and fallback routes those runs exercised.

During A6 the `artifact-design` contract showed that Artifacts render
`<pre class="mermaid">` natively and must not load a Mermaid library; that
rule was added to the reference and its contract.

## Review

One independent review of `b84eede` reported six actionable findings: tour's
temp path blocked publishing; any service could count as a hosted page;
typed Artifacts (decks) conflicted with update by path; remote fonts against
tour's rule; the new fallback clause unchecked; evidence overstated coverage.
All six were fixed. Three optional suggestions were adopted: no publish when
the user asks for the file itself, update only on a revision of the same
visual, scratchpad-only location.

## Gaps

- Codex (no hosted page): `codex exec` 0.149.0 refused to run with the
  configured model ("requires a newer version of Codex") and with `gpt-5`
  ("not supported when using Codex with a ChatGPT account"). Run A7a
  exercised the fallback after a refused publish, but a host with no hosted
  page at all is unverified live.
- tour -> show-me -> hosted page: not exercised live.
- Claude web app, Cursor, Oh My Pi, T3 Code: unverified.
- No graded baseline benchmark; the change is a delivery rule, not output
  quality.

## PR review

Codex review of `10b9801` (P2): when a publish fails, the local fallback opened
a page with no Mermaid script, so a browser showed raw diagram source. The
reference now restores the core's pinned Mermaid import (or inline SVG when
remote resources are forbidden) before opening the local file. Its contract
line was removed once on purpose and validation rejected it. CodeRabbit
reported no actionable comments.
