# Skill creator integration evidence

Status: local integration complete. All four native authoring workflows passed;
the actual user accepted Codex and both Claude examples and review flows. Final
integration review passed with zero actionable findings on attempt 2/3. This receipt distinguishes source checks,
synthetic fixture feedback, and actual human review.

## Source and checks

- Original implementation base: `1bf9f6047602435ff1259503a340eeff0f32703c`.
- Publication base: `bdb2315d2883914d2a6f5c7b071b8d25736e5330`.
- Plugin version: `1.10.0`; twenty-two top-level skills after preserving the
  concurrent UI/UX and Cursor releases. All four version-bearing manifests are
  synchronized, including Cursor. The functional workflows exercised candidate
  `1.8.0` on the original base; later isolated activation and viewer refreshes
  verified `1.10.0`. Rebase verification is recorded below.
- Upstream: `anthropics/skills`, revision
  `ca45fc496a3436251f191354091d557da31c15b5`, `skills/skill-creator`.
- The requested `npx skills use "https://github.com/anthropics/skills" --skill
  "skill-creator"` output was captured completely before following its
  instructions. Supporting resources were resolved from its supplied directory.
- Original upstream `SKILL.md` SHA-256:
  `dcd4803e61e913e6fc27294184cd3a71f09f5e924ff20c8a9a20173e7b3c2bcf`.
- Adapted `SKILL.md` SHA-256:
  `f4abcc97d54d9d6476feae81b66ee2ed8013cc53740918bfbc3fff7a06eeabf6`.
- Publication 22-file creator source and isolated Codex cache match. Tree SHA-256:
  `fd8f05797fd25875f9b8c4ed0796793d27305c3426025bd2f5443b1c21f5021b`
  (SHA-256 of compact, sorted JSON mapping relative paths to file SHA-256;
  Python bytecode caches excluded).
- `python3 scripts/test-skill-creator.py`: passed. Independent helper verification
  also passed, including path/symlink rejection and executing viewer JavaScript
  to check the completed feedback Blob.
- `bash scripts/validate.sh`: passed on Linux for final `1.10.0`, including proposal cleanup and
  host-mapping fixes. `git diff --check` also passed. Seventy intentional contract
  mutations were individually rejected. This does not claim live macOS/Windows
  verification.

## Native acceptance fixture

Each fresh project creates or improves `skills/release-note/SKILL.md`. The
required output contains exactly `Changes`, `User impact`, and `Verification`
sections, using supplied facts only.

```text
Change: Export now preserves CSV column order.
User impact: Existing column mappings remain valid.
Verification: The column-order regression check passed.
```

The second input omits the verification line. Creation starts with literal
`unknown`, then accepts one explicitly covered synthetic feedback revision to
`Not provided`. Improvement starts with a seeded skill that wrongly instructs
inventing successful verification; its immutable pre-edit snapshot is the
baseline. Fresh no-target-skill sessions are the creation baseline.

Every comparison uses the same input and task requirement, matched host defaults
and permissions, one actual run per configuration per fixture, and grades based
on saved output. The marker requirement changes equally for both sides in the
second creation iteration. Equal fixture weighting and real repetition counts
are preserved. Ties are valid; these tiny fixtures establish workflow behavior,
not general quality or statistical superiority. Unknown metrics remain unknown.

## Observed native workflows

| Host / workflow | Evidence observed | Status |
| --- | --- | --- |
| Codex creation | Registered plugin; plan questions and clean plan QA; target absent before approval; `implement-plan`; four fresh output runs in each of two iterations; completed synthetic feedback; preserved original; clean final review | Passed; actual human accepted examples and review flow |
| Codex improvement | Read-only immutable old snapshot; actual old/new outputs; benchmark; corrected prompt display; fresh clean final re-review | Passed native workflow |
| Claude Code creation | Reviewed plan; explicit approval; verified helper preflight; two actual iterations; completed synthetic feedback; preserved original; clean final target review | Passed; actual human accepted examples and review flow |
| Claude Code improvement | Reviewed plan and approval; immutable old snapshot; four fresh actual runs; source-preserving edit; benchmark; clean final target review | Passed; outer audit and actual human acceptance complete |

Codex CLI `0.163.0`, Linux, selected `gpt-6.1-sol` at high reasoning through the
configured gateway, `workspace-write` with `never` approval policy. The outer
verifier inspected eight actual child-session records: fresh contexts with the
correct parent, provider/model/effort matched, no baseline tool command reading
the target skill. All four actual skill outputs across both iterations were
independently checked against the complete expected text. Both bundled
benchmarks contain complete four-run pairs with unknown time/token metrics.

Each Codex creation iteration passed 10/10 skill assertions versus 9/10 for its
baseline. The only difference was exact marker spelling/punctuation (`Unknown.`
instead of `unknown`, then `Not provided.` instead of `Not provided`). The
final target SHA-256 is
`6cbf37da86293ce4b902554139a655728389ea3f3538b0524bf6220f52b8403e`.
Independent target review passed with zero actionable findings on attempt 1/3;
the native turn timed out while awaiting delivery, then resumed and reused the
already delivered result after all 32 review pins matched. No review-budget reset,
target edits, or evaluation reruns occurred on that acceptance resume.

On 2026-10-30 the actual user inspected the revised Codex review artifact and
answered the native feedback question: “Accept these Codex examples and review
flow.” This accepts the Codex examples and review flow; it does not stand in for
the Claude verification or final integration review, which were still pending
at that checkpoint and subsequently passed separately. The original
native receipt's pending status is preserved as historical evidence; the outer
verification record holds this later human response separately.

Codex improvement used two fresh sessions under the same actual provider/model/
effort, one for the immutable old skill and one for the revised skill. The old
missing-verification output said “All tests passed.” The revised output says
`Not provided`, and supplied verification remains unchanged. Revised assertions:
8/8; old assertions: 5/8, including two heading-level failures. Source frontmatter
is unchanged. Final target SHA-256:
`a9e40a7cd47e39ad163e22fcaf004b1bb41cf486f139bff4cd78a39d59d40b07`.
Independent final review passed on attempt 2/3 after a display-only prompt-path
correction; all four actual output files were preserved. Blank/whitespace behavior
has source-review coverage only.

A separate fake-process probe reproduced an optional optimizer defect: a proposal
timeout left its descendant alive. The regression failed before the fix and
passed after adding owned process-group cleanup. The isolated Codex package was
refreshed again. Later updates narrow the optional proposal process to text-only
tools and document the observed Claude helper-directory authorization. At that checkpoint, core
instructions and all portable evaluation/viewer helpers exercised by the
completed Codex workflows were byte-identical; later viewer fixes are recorded below. No live optimizer result is claimed.

Claude Code CLI `2.1.296`, Linux, selected `claude-sonnet-5-5` at high effort,
`acceptEdits`, with permission prompts disabled. An initial helper command was
denied and the native workflow stopped before target creation. The synthetic
fixture owner explicitly authorized the trusted creator directory with
`--add-dir` and fixed absolute `python3 -B` helper entry points. Preflight passed
under that scoped setup; permission mode stayed unchanged. The denied routes
are retained, and are not claimed to have passed. The host mapping now records
this observed requirement.

Claude creation plan QA reached its initial three-attempt cap; the synthetic
owner explicitly granted one additional attempt twice. The fifth full review
was clean. No target implementation began before separate approval of that
reviewed hash. This fixture-plan continuation does not reset or extend the
integration implementation review budget.

Both Claude creation iterations tied: every saved skill and no-skill output
passed all five assertions. The outer verifier checked all eight actual files,
eight distinct native child records, matching Sonnet models, no mutating child
tools, and no baseline read of the target. Saved token counts and seconds match
native harness totals and millisecond durations exactly. These one-run samples
support no cost or general quality conclusion. Original target SHA-256:
`2cca3212ca69d00fc9379660eec3115aec812e658121d84a385314bbf774dc3b`;
final target SHA-256:
`18efd7cce0129f328cdbf6a330b190bd5d989683128e8a6f77d1c592cc9dc879`.
Completed feedback is synthetic. The native workflow preserved its 23 pinned
iteration-1/snapshot files, changed only the approved Verification line, and
passed final independent review on attempt 1/3. Actual Claude human feedback
was requested separately and is now accepted, as recorded below.

Claude improvement preserved the original name/frontmatter and a mode-0444 old
snapshot. The native run stopped at a denied compound permission command; the
synthetic owner authorized the exact snapshot-only `chmod` command, which then
ran separately under the same permission mode. Four fresh foreground children
produced actual old/new outputs on the same two inputs. The revised outputs
passed 8/8 assertions; old outputs passed 7/8. The old missing-verification run
refused to invent success and used a bulleted no-information sentence. The sole
measured difference is the revised bare `Not provided` wording; no reproduced
invented-success failure or heading gain is claimed. Both normal outputs retained
the supplied verification. Equal-fixture pass rates were 1.0 versus 0.875.
Single-sample means were 4.5565 versus 5.9215 seconds and 26969 versus 27091.5
tokens. These observations establish no cost or general-quality conclusion.
Final target review was clean on attempt 1/3. Independent outer audit confirmed
all four native Sonnet child records, assigned-only reads, actual saved output
text, grades and exact native telemetry. Final target SHA-256:
`21803396fb906337b58070e1145fc23be482cc3820da478bfc64e1625f40ab36`.

## Isolation and limits

Codex uses its native marketplace/plugin commands with a disposable process-scoped
configuration root. Claude Code uses `--plugin-dir` and a disposable
`CLAUDE_CONFIG_DIR`. Provider credentials are resolved at runtime from a secret
reference; no credential store or secret value is copied into this repository.
Only synthetic fixtures are sent to the models.

An early Codex driver erased its scratch registration between turns. That
attempt is excluded from installed-plugin acceptance. The driver was corrected,
the plugin was registered again, and definitive verification began in a fresh
project/conversation after native `plugin list` confirmed installed/enabled.

Browser preview found stale Claude-specific feedback instructions in the imported
viewer. The header was corrected to describe portable `feedback.json` download.
The isolated Codex plugin was refreshed through its official remove/add commands;
the affected viewer was regenerated and browser-rendered without console errors.
Only the presentation supplied to T3 replaces viewport height with a fixed frame
height; the standalone review artifact is preserved.

The optional POSIX Claude description optimizer has local fake-test coverage;
no live optimizer support is claimed. Native CLI evidence does not establish
activation in the current T3 conversation or other provider configurations.
Synthetic completed feedback proves the feedback round trip and covered revision;
it does not establish human acceptance or an actual human download gesture.

The original local-only phase did not publish or upgrade shared plugins.
The user later authorized publication and merge; see the publication section.

Shared-state comparisons did change during this task: a separate authorized UI/UX
release updated the installed registrations, then the independent Cursor release
updated the shared package. The shared Codex `1.9.0` tree matches all 82 files of
public commit `bdb2315d2883914d2a6f5c7b071b8d25736e5330` byte for byte. Root Codex
provider configuration remained unchanged. This integration used only disposable
configuration roots and did not upgrade or restore the shared installation.
Whole-session shared byte equality is therefore not claimed.

Fresh read-only final-package conversations in both native hosts returned
`FINAL_PACKAGE_ACTIVATION_OK`, resolving `1.10.0` and independently reading the
final core, Claude mapping and optional proposal helper hashes. The outer audit
confirmed Codex's successful source-read tool output and actual Sol/high context,
and Claude's actual namespaced Skill call, Sonnet records and successful hash
output. Codex first tried an unavailable `python`, then succeeded with `python3`.
Claude retained a denied compound read command and completed individual allowed
reads. These are activation/identity checks, not reruns of the four functional
workflows. At that checkpoint core and portable evaluation/viewer helpers were unchanged;
subsequent viewer fixes and their native refresh checks are recorded below.

Full integration review attempt 1/3 found two actionable defects: benchmark
evidence could escape a quoted tooltip attribute (and repetition metadata could
be interpreted as markup), and an exited optional trigger process could block
reading a descendant-held stdout pipe past its timeout. Both were reproduced
and fixed. The viewer now escapes quotes/metadata and rejects fixture/count
metadata that disagrees with saved runs. The trigger reader drains only ready
chunks within the deadline, retaining owned process-group cleanup. Regressions
execute the actual benchmark renderer, reject false counts, and force the exited
parent race. They fail against the original implementations and pass after fixes.
The first temporary timeout test had an invalid relative-root setup; it was
corrected before confirming failure on the original helper.

These fixes change the viewer generator/template and optional trigger helper.
Native evaluation output, grades and target skills are preserved. Final static
viewer regeneration and synthetic feedback re-import passed through fresh
conversations in both native hosts. Outer verification confirmed actual helper
commands, final package hashes, model records, and identical embedded runs,
benchmarks and previous-iteration content in all six final viewers. The first
Codex refresh used an incorrect test-driver improvement path; it failed visibly.
A fresh corrected conversation used the canonical `iteration-1` directory and
passed all four helper commands. The failed attempt is retained and excluded
from final refresh acceptance. Fresh independent integration re-review passed on attempt 2/3 with zero
actionable findings. It reran helper checks, verified all six final artifacts
against the revised template/workspace data, and checked all 126 source pins.

Cleanup found runtime credentials in two task-local native Codex shell snapshots.
Those snapshots were removed; retained workflow JSONL/tool/output evidence remains.
A fresh exact-value scan found no credential values across the remaining 6030
runtime/package files. This establishes cleanup, not absence of temporary native
credential persistence. No shared credential files were copied or changed.

After the final native refresh, another exact-value scan passed across 6069
remaining runtime/package files. The temporary secret-reference environment file
was removed. No test-owned native process remains.

The clean substantive review snapshot SHA-256 is
`7ad1e627ef2f7b537270f1006aa135c8942e765c5ecaadda58287ac4dfda8786`
(compact sorted path-to-hash map, 126 files). Only this administrative status
record was updated afterward. No source findings or optional suggestions remain.
The actual user subsequently accepted the Claude creation examples and, in a
second explicit response, both Claude creation and improvement examples and
review flow: “Accept these Claude examples and review flow.” These responses
are recorded separately from synthetic feedback, with the reviewed artifact
hashes. All local integration acceptance gates are now satisfied. No commit,
publication, shared-installation update, or latest-main merge is implied.

## Publication integration

The user subsequently authorized the end-to-end publishing workflow and merge.
[Issue #47](https://github.com/tzachbon/srulik-toolkit/issues/47) preserves the
scope, execution plan and acceptance criteria outside the conversation.

The task branch was rebased onto the UI/UX and Cursor releases. Conflict
resolution preserved both license notices, both new skills in the catalog and
startup hint, Cursor's install documentation/hooks/manifest, and every existing
validator. The creator validator is now part 8, following the existing UI/UX
part 7. Root `AGENTS.md` routes skill authoring through the namespaced creator;
root `CLAUDE.md` imports that same guide. The imported viewer has an exact-path
vendored attribute under the repository's large-file commit policy.

The only creator-source change during publication integration removes one
trailing space from an optional proposal prompt. Its pre-publication tree was
`f9a35e8b0f2d27a1235a0d163c61fbed4263fd5a524a4c8ba7d39813d2f09330`.
Core instructions, portable helpers and every viewer source remain byte-identical
to the human-accepted/native-refresh state. No additional model evaluations or
quality gains are claimed from this metadata integration.

Full repository validation passed on the combined state, including existing
UI/UX and Cursor contracts, all creator helper regressions, and native manifest
validation. `git diff origin/main --check` passed for the complete publication
diff, including newly added files. Fresh post-rebase package activation passed
in both native hosts: actual source/helper hashes, version, all three plugin
manifest versions, 22 top-level skills and 24 recursive files were verified from
the native tools. The two extra files are existing internal to-project helpers.
The first Codex probe incorrectly required 22 recursive files; a corrected fresh
conversation passed. Denied or unavailable read commands remain in the evidence.

A fresh independent publication integration review passed on attempt 1/3 with
zero actionable findings, preserving the two earlier local review rounds. Its
140-file source snapshot SHA-256 is
`b5139497755384392a704a43cd3d9f1c4347c53c1d9fd807fece5f5be9a20d71`.
Only this administrative receipt was updated after review. A fresh cleanup scan
found zero credential-value matches in 6089 retained runtime/package files, and
the temporary secret-reference environment file was removed again. Cursor
runtime authoring and live optional optimization remain unverified.

Remote CI, review conversations and provider-verified merge/issue closure are
subsequent publication gates; this source receipt does not predeclare them.

Review-fix evidence is recorded in [the follow-up receipt](skill-creator-review-fixes.md).
