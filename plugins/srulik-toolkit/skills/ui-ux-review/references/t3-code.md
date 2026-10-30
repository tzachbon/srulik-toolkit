# UI UX review on T3 Code

## Capability mapping

| Capability | T3 Code through Codex |
| --- | --- |
| Stories, requirements, tokens, components | Native file reads and repository search; inspect supplied artifacts before connected sources. |
| Direct image inspection | Native `view_image` for local images; inspect the returned image itself. Capture tools and image-generation success messages are not image inspection. |
| Browser interaction requested by the user | `preview_status`, then `preview_open` when no tab can be automated; use snapshot locators and close tabs opened for the review. |
| Validation of the agent's own edits | Never use `preview_*`; use the project's authorized browser/test harness, capture renders, then open the images with the native image viewer. |
| Device interaction | `device_list`, `device_open`, returned launcher, and `device_screenshot`; preserve the supplied launcher flags. |
| Clarification | Native asynchronous question tool during ongoing work; follow its restrictions for approvals and secrets. |

Follow the current host instructions when they narrow this mapping. A
Playwright CLI session needs a unique task session ID, reused on every command
including close. Check resources before browser/build work, follow configured
remote-browser routing under load, and stop only processes started for the
review. Reading a generated PNG is separate from showing it to the user;
use T3 Code's required image or visual-delivery mechanism when delivering it.

This mapping records available tool contracts. Local image inspection and
artifact-only story/design-system review can be exercised independently.
Live browser/device workflows and full application acceptance remain unverified
until the reviewer performs them on the target instance; this reference does
not make those checks pass. This reference documents T3 Code through Codex
only. Other provider backends on T3 Code follow the core's untested-host gate:
show the capability mapping, label it untested, and obtain user confirmation
before proceeding. Verify their native image-viewing capability rather than
assuming the Codex tool names apply.
