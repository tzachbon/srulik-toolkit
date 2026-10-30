# Skill creator late-review follow-up

## Scope and authority

The original integration's optional-helper correctness work continues with two
focused fixes, regressions, full repository validation, independent source review
and one follow-up PR. The user expressly forbids merge, auto-merge, deployment,
PR approval, protection bypass and shared-installation upgrades. Fast mode stays
disabled. Historical native evidence and its limits remain intact.

Execution through the existing approved plan and `implement-plan` is limited to:

1. Reproduce the two late findings on merged main and correct issue #47's status.
2. Continue trigger observation across unrelated tools, preserving terminal
   errors, timeouts and owned process/temporary-command cleanup.
3. Reject stratified holdouts that cannot retain train/test examples per present
   class; document adding examples or explicitly disabling holdout.
4. Add local-only regressions, run repository validation, obtain independent
   review, then publish one reviewable PR with current-head evidence.

## Timeline correction

PR #48 merged at `2026-10-30T16:15:41Z`. Its exact-head Codex review posted
[two](https://github.com/tzachbon/srulik-toolkit/pull/48#discussion_r4425826789)
[findings](https://github.com/tzachbon/srulik-toolkit/pull/48#discussion_r4425826801)
at `16:15:56Z`, fifteen seconds later, against
`998eef1b72fa596d2c1b066ef11899a49abaed27`. Both defects remained in squash merge
`201104e5760375ca4a543b9a91e2aa834275c244`, the baseline for this follow-up.
The earlier terminal report did not account for them. Earlier passing CI and
independent reviews remain historical evidence, not proof that the later review
was complete. Issue #47 was reopened and its completion wording corrected.

## Reproduction and expected behavior

`python3 -B scripts/test-skill-creator-optimizer.py` exercised the merged helpers
before changes. All inputs use local fakes; no paid/native model is called.

| Case | Observed before | Required after |
| --- | --- | --- |
| Full assistant Read README.md, then target Skill in the same or a later message | False | True |
| Streamed unrelated Bash and Read, message_stop, then target Skill or Read | False | True |
| Unrelated tools then error, EOF without result, or timeout | False | Raise; no scored non-trigger |
| Unrelated tools then successful terminal result | False | False, with cleanup |
| One positive and one negative query, default 0.4 holdout, both fail | `all_passed (iteration 1)`, train `0/0`, test `0/2` | Reject before evaluation/proposal calls |
| Same two queries with explicit holdout 0 | Training retains both | Failed queries still reach improvement; no held-out result claimed |

The trigger fix removes premature negative returns and resets stream-block
state. Positive target detection still exits early; a successful terminal result
is required for a negative outcome. Existing process-group cleanup and bounded
pipe reading are preserved.

Holdout now requires at least two queries per present class. Each accepted class
retains training and held-out examples. Fractions outside `[0,1)` are rejected;
zero explicitly disables holdout. One-class sets with enough examples remain
supported. No fallback silently discards the requested holdout.

The committed regression is invoked by the existing helper check and therefore
by `scripts/validate.sh`. It checks complete and streamed events, misleading
unrelated tool arguments, terminal success/error, EOF, timeout, process reaping,
temporary commands, undersized/mixed singleton strata, explicit no-holdout,
valid stratified sets and invalid fractions. Existing regressions continue to
cover descendant-held pipes and owned process-group cleanup.

## Evidence boundaries

Package metadata advances together to `1.10.1`; this is source packaging, not a
shared upgrade. No previous native outputs, grades, accepted viewers, human
receipts or integration receipts are rewritten. Neither native authoring nor
package activation is rerun for these helper fixes. The optional live optimizer
remains unverified; local fake tests do not establish model trigger accuracy or
quality/cost gains. POSIX trigger subprocess checks skip explicitly on Windows;
platform-independent holdout tests still run there.

Final validation, independent review and exact published-head CI are reported in
the follow-up PR rather than predeclared by this source receipt.
