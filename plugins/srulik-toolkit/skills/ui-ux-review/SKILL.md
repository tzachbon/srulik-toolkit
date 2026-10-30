---
name: ui-ux-review
description: Review every in-scope user story against actual interface renders, screenshots, or generated design images and the project's design system. Validate usability, accessibility, visual consistency, responsiveness, and interaction feedback; source-only inspection is incomplete visual coverage.
license: MIT
---

# UI UX review

Review whether people can understand and complete the intended task. Preserve
the product's audience, platform conventions, and established design system.
Return findings without editing files or redesigning the interface unless the
user separately requests implementation. A review does not authorize publishing
comments, installing tools, or submitting real transactions.

Before reviewing, identify the host's file, image-viewing, browser/device, and
question capabilities. On T3 Code, read the [host mapping](references/t3-code.md).
On a harness with no documented reference, show the capability mapping, label
it untested, and obtain user confirmation before proceeding. Missing image or
runtime capabilities leave the affected checks incomplete; availability alone
does not prove that an action was performed.

## 1. Bind stories, design system, and capabilities

Read the request, product requirements, user stories, acceptance criteria, and
relevant design artifacts. Review every user story in the agreed scope, not
only the primary happy path. For a diff, include affected stories, states, and
shared components; do not expand to unrelated product areas. Preserve story
IDs. If no stories are documented, derive a provisional list from the request
and interface, label it inferred, and identify missing requirements. Never
silently drop a story because its screen or evidence is unavailable.

Establish whether the target is a design artifact or an implemented interface.
Create a coverage matrix before reviewing: story/criterion, screen and state,
design reference, visual evidence, behavior evidence, result, and finding IDs.
Use `PASS`, `FAIL`, `UNVERIFIED`, or `BLOCKED` per applicable criterion;
explain any not-applicable checks. A screenshot can verify a visible design
requirement, not whether the implemented journey works.

Always look for the project's design system first: design documentation,
approved mockups, tokens, component libraries, existing screens, and platform
conventions. Record the authoritative baseline and any approved exceptions.
Inspect installed components before proposing custom controls. If no system
exists, identify a reusable installed system or native platform baseline as a
proposal, report the gap, and resolve choices that affect acceptance through
the host's question capability. Do not invent brand rules or install a system
under review-only authorization.

## 2. Inspect the actual images and rendered design

Open and visually inspect every in-scope supplied or generated design image,
and the actual rendered screens for an implemented interface. Use an image
viewing capability; file existence, screenshot metadata, a generator's success
message, alt text, and source code do not count as looking at the image.
Record which images were opened and their story, screen, state, and viewport.
For multi-screen boards, inspect each screen at a readable scale; request or
capture a clearer view when details are illegible.

For generated designs, check story coverage, content, layout, legibility,
controls, and required states directly in the output. Compare each applicable
screen against the design-system baseline and approved references: component
variants, tokens, typography, spacing, color, icons, action hierarchy, and
interaction affordances. For implementations, compare actual renders with the
approved design as well as the system. Separate intentional approved changes
from unexplained drift; visual differences need a requirement or user impact
to become defects. Recommend reuse of existing components and tokens first.

Inspect supported narrow/wide layouts, themes, long content, and relevant
states. A single attractive screenshot does not verify the remaining screens.
If an expected image, design reference, render, or viewing capability is
missing, mark the affected criteria `UNVERIFIED` or `BLOCKED`, identify the
needed evidence, and continue independent checks. Source-only inspection is
partial review and cannot satisfy visual acceptance.

## 3. Validate each story's journey and UI quality

Read the [review checklist](references/checklist.md). Apply every relevant
category; record why a category is not applicable rather than manufacturing
findings to fill it. Treat numeric heuristics as context-dependent guidance;
identify the applicable accessibility criterion or platform rule before
calling something a standards violation. A review is not accessibility
certification.

For upstream context or comparison, consult the
[original UI UX Pro Max skill](references/ui-ux-pro-max.md), its
[full rule set](references/quick-reference.md), and its
[professional UI checks](references/pro-rules.md). These are archived source
references; this skill's review workflow and checklist take precedence.
Upstream generation/search tooling and datasets are not bundled or authorized
by this review. Apply only guidance relevant to the reviewed task.

For every in-scope story in an implemented interface, exercise its acceptance
criteria and relevant alternate, failure, and recovery paths in the running
interface. Use the project's existing validation pipeline where available;
automated assertions supplement direct visual inspection. Use test data and a
safe environment; stop before purchases, messages, deletion, or other effects
outside the user's authorization. Inspect keyboard focus and dismissal,
loading/empty/error/success states, narrow and wide layouts, zoom or text
scaling, reduced motion, and supported themes as applicable. Choose viewports
from the product's supported devices and layout boundaries. Capture the exact
route, state, viewport, and reproduction steps for observed failures.

For design artifacts, judge the visual criteria and story/state coverage;
interactive behavior remains `UNVERIFIED` until exercised in an implementation.
A screenshot supports visible layout findings, not keyboard, screen reader,
responsive, or runtime verification. Source inspection can establish explicit
markup or logic defects; unexercised runtime effects remain hypotheses.
Distinguish observed behavior, source evidence, and unverified concerns.

If browser, device, accessibility, or measurement capabilities are unavailable,
finish the supported checks and list untested checks as evidence gaps. Measure
contrast and performance when the relevant tools are available. Never invent
measurements or test results, or equate missing access with a pass.

## Judge impact and recommend the smallest repair

Prioritize task blockers, inaccessible controls, lost input, and misleading
state before visual polish. Severity follows demonstrated user impact, not
the checklist category. Keep subjective preferences separate from defects;
different fonts, palettes, or animation styles are not defects by themselves.
Recommend changes that reuse existing components and tokens. Do not prescribe
a new design system, dependency, framework, or animation solely to fit a style.

## 4. Report findings and close the coverage matrix

Lead with findings ordered by severity:

- **High:** blocks a primary task, excludes an input/access method, risks data
  loss, or misrepresents an important outcome.
- **Medium:** causes recoverable errors, hides information, or adds material
  friction to the task.
- **Low:** a demonstrated consistency or readability issue with limited impact.

Each finding includes the affected screen/component and state, evidence or
reproduction steps, the user consequence, the smallest recommended repair, and
a concrete verification step. Link the source location or visual evidence
when available. Mark hypotheses as unverified concerns, not confirmed findings;
merge duplicates that share a cause. Keep optional aesthetic suggestions
separate and omit them unless requested.

Return the story-by-story coverage matrix, design-system baseline, opened image
and render references, exercised journeys, findings, and remaining evidence
gaps. Include states, viewports, input methods, and themes actually checked.
Coverage is `COMPLETE` only when every applicable criterion in the declared
scope has been checked with the appropriate evidence; any in-scope `UNVERIFIED`
or `BLOCKED` criterion makes coverage `INCOMPLETE`. A checked failure is `FAIL`,
not missing coverage. A clean verdict additionally requires no failed criteria
or substantiated defects. Never turn passing code checks into a visual pass.

If no substantiated issues remain, say "No substantiated findings in the
reviewed scope" alongside the coverage verdict and limitations; incomplete
coverage is not approval. Label design-only acceptance explicitly and retain
unverified implementation criteria. Stop after delivering the review. Hand
off code correctness to
`review-pro-max`, substantial remediation planning to `create-plan`, and
execution to `implement-plan` when the user requests those next steps.

## Attribution

Adapted from [Next Level Builder's UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/tree/28b3b8dee8c976df4fa3e94aed4e092ad43fcb03),
specifically its review priorities, UX guidelines, and professional UI checks.
This adaptation retains review criteria and omits design generation, searchable
catalogs, and stack-specific implementation tooling. Copyright (c) 2024 Next
Level Builder. Original MIT terms are preserved in [LICENSE](LICENSE).
