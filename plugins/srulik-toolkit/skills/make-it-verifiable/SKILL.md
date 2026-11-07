---
name: make-it-verifiable
description: Make a change fully verifiable, with one red-proven check per claim. Use before implementing a change to build the checks that will prove it, or after a change to find and prove what is still unverified.
license: MIT
---

# Make it verifiable

Adapted from the feedback-loop phase of [Matt Pocock's diagnosing-bugs](https://github.com/mattpocock/skills/blob/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d/skills/engineering/diagnosing-bugs/SKILL.md) and generalized from bugs to any change. Original copyright and MIT terms are retained in [LICENSE](LICENSE).

A change is **verifiable** when every **claim** it makes has a **check** you have already watched go **red**.

- A **claim** is one thing the change says will be true: an acceptance condition, or an observable effect on callers, data, UI, config, or docs. A **new** claim is false before the change; an **invariant** claim is true now and must stay true.
- A **check** is one named command, or one scripted human step, that observes one claim. It is **red-capable** when it fails while its claim is false, and **tight** when it is fast, deterministic, and agent-runnable.
- **Check artifacts** are files that exist only to run checks: tests, scripts, fixtures, and harnesses.

**Contract mode** runs before the change exists and returns the checks that will prove it. Run audit mode after a change to find every claim without a proven check and prove it. Contract mode writes check artifacts only and leaves application behavior as it is. When the caller keeps the workspace read-only, work in a scratch copy outside it and hand the artifacts back as the first task of the guarded work.

## Capabilities

This needs running commands, a scratch copy outside the workspace, and asking the user. Read [host mappings](references/hosts.md) for the current host. On an undocumented host, show the capability mapping, label it untested, and act after the user confirms.

- Contract mode without commands or a scratch copy: name every check fully and mark it `planned-red`.
- Audit mode without them: report which capability is missing and stop.
- Without a way to ask the user, a claim that needs acceptance stays `blocked`.

## 1. Define "fully" for this change

Write the numbered claim list: every acceptance condition, and every observable effect on callers, data, UI, config, and docs that you find by tracing the change. Mark each claim new or invariant, and cite its source: the request, the plan, or an inspected caller. In audit mode, read the diff and its existing evidence; a check that cannot fail, such as a value compared with itself, leaves its claim open.

Done when no inspected caller or acceptance condition lacks a claim.

## 2. Build one tight check per claim

Climb the ladder in [feedback loops](references/feedback-loops.md) and take the first rung that observes the claim directly. Assert the exact claim, not that the code ran. A check that reads a plan, spec, or other description of the change proves only that the text exists; a claim about behavior or an outcome needs a check of the effect itself, or a scripted human step. Hand a new test at a code seam to `tdd`, which owns the red-green loop there.

Done when each claim names one red-capable, tight check, or one scripted human step.

## 3. Watch every check go red

- **New claim:** run the check before the change; it fails.
- **Invariant claim, or any claim in audit mode:** break the claim with one mutation in a pristine copy, `diff` the copy against the original to prove the mutation landed, run the check red, restore, and run it green.

Show each invocation and its output, redacted as the feedback-loops reference describes.

Done when every row has red evidence, or is a fully named `planned-red` check (contract mode, host cannot run it) whose red proof is the guarded work's first task.

## 4. Label what remains

A claim with no feasible red-capable check is `blocked`. Audit mode accepts only `verified` or `accepted-unverified` rows. Ask the user to accept each blocked claim by name, giving the reason and the access or scripted step that would verify it. Record the answer verbatim and mark the row `accepted-unverified`.

Done when no row is `blocked`, or the caller knows which rows block it.

## 5. Return the contract

Return the verification contract and the paths of its check artifacts:

| # | Claim (type, source) | Check | Red evidence | Green evidence | Status |
| - | --- | --- | --- | --- | --- |

Status is one of:

- `verified`: red proven, green observed.
- `pending-green`: red proven, change not built yet (contract mode).
- `planned-red`: contract mode on a host that cannot run the check; proving it red is the first task of the work it guards.
- `accepted-unverified`: the user's acceptance, quoted with its reason.
- `blocked`: none of the above. The caller decides what a `blocked` row stops.

Done when every row has a status.
