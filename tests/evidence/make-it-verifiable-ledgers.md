# make-it-verifiable rewrite ledgers

Prune ledgers and the execute-task-end-to-end validator mapping from the create-plan (T4) and execute-task-end-to-end (T5) restyles. The create-plan validator mapping is in [make-it-verifiable-create-plan-mapping.md](make-it-verifiable-create-plan-mapping.md). Summary and results: [make-it-verifiable.md](make-it-verifiable.md).

## create-plan prune ledger

Format: `P# | removed text | location | reason | covering eval expectation`. Locations are in base `SKILL.md` (`6438427`). Every cut is either a duplicate whose meaning still lives in one named place, or a clause that changes nothing against the model default. No validator phrase was removed (see [create-plan-mapping.md](make-it-verifiable-create-plan-mapping.md)).

The covering expectations are proposed text for the T6 CP fixtures. Grade each one on both `old_skill` and `with_skill` runs; a with_skill miss that repeats on rerun restores the linked P#.

| P# | removed text | location | reason | covering eval expectation |
| --- | --- | --- | --- | --- |
| P1 | "Use layered structure so the reader can scan the overview and then work through full task instructions. Keep material rationale and evidence in the plan even when they also appear in a source document. Repeat a critical contract in a separately delegated task when that executor would otherwise miss it. Remove filler and duplicate work, but preserve useful explanation, examples, edge cases, and recovery instructions. There is no word-count target: completeness determines length." | Default depth, paragraph 3 | Duplicate. `references/detailed-plans.md` "Depth and structure" (overview then detail, no word count, repeat the critical subset per subplan) and `quality-gates.md` Gate 9 (preserve rationale even when it repeats a source, repeat critical contracts in delegated tasks, remove filler). "Completeness determines length" moved into paragraph 1. Both files are read before drafting and finalizing. | CP1, CP3: "The plan is self-contained: every task has execution steps, a completion gate, and failure handling, and the plan is not an outline." |
| P2 | "rather than silently skipping" (end of "Record the evidence for every condition ...") | Step 2, strict-trivial paragraph | No-op clause: "Record the evidence for every condition" already demands the evidence. | CP1: "`## Skill handoff` records the discovery status, with an exact external search per material discipline or evidence for every strict-trivial condition." |
| P3 | "- discover relevant installed skills and invoke those needed for planning evidence or analysis" and "- run and retain external discovery evidence for each material discipline unless the strict-trivial gate passes" | Step 2, "During research" list | Duplicate of rule 9 and step 2 paragraph 1 (catalog inspection, one search per discipline, load only when it improves planning). | CP1, CP3: same as P2. |
| P4 | "Keep bounded, low-risk assessments brief." | Step 3, after the risk bullets | Duplicate of "scaling detail to the stakes" in the same step and the step 8 rule that short paragraphs may replace the risk table for bounded low-risk work. | CP1: "Impact, blast radius, and door are assessed, in proportion to the bounded `--json` change (short paragraphs are acceptable)." |
| P5 | Layer list: "1. foundation: ... 2. shape: ... 3. edges and adversarial pressure: ... 4. execution and closure: ..." | Step 5 | Duplicate of `grilling.md` "Escalate through depth layers", which step 5 now points to; the order survives as "Escalate from foundation to shape to adversarial edges to execution closure." | CP1, CP3: "Grill questions come in numbered waves of at most 4, each with a recommended answer, and the Expected outcome and Definition of Done are asked as two separate questions." |
| P6 | "Questions in the same wave must be independently answerable from the current state. Never batch a downstream question with the upstream decision that determines how it should be asked. Every question should resolve one decision boundary or hidden assumption and include a recommended answer when useful." | Step 5 | Duplicate of `grilling.md` "Build the design tree first" (no dependent questions in one wave) and "Construct each wave for cheap answers" (one decision boundary per item, recommended answer). | CP1, CP3: same as P5. |
| P7 | "Even when the brief appears complete, run one adversarial completeness wave against the highest-impact assumptions, tradeoffs, failure modes, or definitions of success that could still make the plan wrong." | Step 5 | Duplicate of rule 4 and `grilling.md` "Minimum grill invariant" and its completion-test final adversarial wave. | CP1, CP2: "At least one adversarial grill wave (failure modes, edges, or assumptions) is asked even though the request looks complete." |
| P8 | "Never ask the user to repeat something available in evidence." | Step 5 | Duplicate of rule 6 and `grilling.md` "Research instead of asking". | CP1: "No grill question asks for a fact the fixture repo already shows, such as the caller `cron/report.sh` or the existing test." |
| P9 | Trigger list: "points to a file, system, document, dependency, standard, owner, constraint, or prior decision / chooses an approach whose feasibility or implications should be verified / depends on a factual premise / contradicts existing evidence / exposes a new domain, dependency, edge case, or risk / changes the plan enough that earlier research may no longer apply" | Step 6 | Duplicate of `grilling.md` "Re-research triggers". The two items G lacked ("a new edge case", "a change large enough that earlier research may no longer apply") were added there, so the list has one home. | CP3: "Facts exposed by the answer-sheet answers (for example the current `sessions` storage code and config) are inspected and cited before the plan is drafted." |
| P10 | "Do not sequence by narrative convenience." | Step 9 | Duplicate of "Build the dependency graph before final ordering" in the same step and Gate 2 ("Fail the gate when the order is only narrative"). | CP1, CP3: "Work items have stable IDs and explicit dependencies, and their order follows those dependencies." |
| P11 | QA bullets: sufficient depth; requirement and scope coverage in the traceability table; no unexplained execution context; dependency-correct ordering; outcome-based validation; visible assumptions and deferred decisions; recovery or stop conditions; skill handoff present and phase-specific; discovery evidence per discipline; incomplete discovery labeled `INCOMPLETE`; no duplicate or decorative work and no removal of useful context | Step 10 | Duplicate of `quality-gates.md`: Gates 9 and 3 (depth, context), 1 (coverage), 2 (ordering), 5 (validation), 7 and 3 (assumptions, deferred decisions), 6 (recovery), 8 (handoff, discovery, `INCOMPLETE`), 9 (filler). Step 10 now says "against Gates 1–10" and keeps the three bullets with no gate home (evidence-backed facts, verified names, no resolvable placeholders). | CP1–CP3: "The acceptance table traces every requirement to a task and a check, consequential risks have stop or recovery conditions, and `## Skill handoff` is present with its discovery status." |
| P12 | Skill orchestration items 1–7: classify and inspect early; one external search per discipline; invoke installed skills only when they improve planning; re-check after the grill; include `## Skill handoff`; state timing and output per skill; name a missing capability instead of inventing a skill | "Skill orchestration" | Duplicate of rule 9, step 2, and `skill-routing.md` (planning-time invocation, re-evaluate after domain expansion, mandatory final handoff, per-skill timing and output) plus Gate 8 (missing capability). Item 8 (plan invalid until the handoff records discovery status) stays verbatim. | CP1–CP3: "`## Skill handoff` starts with the discovery status and names exact skills with invocation timing." (The `make-it-verifiable` audit-mode routing is a separate new-behavior expectation, not a prune check.) |

## execute-task-end-to-end prune ledger (T5)

Format: `P# | removed text | location | reason | covering eval expectation`.

| P# | Removed text | Location (base) | Reason | Covering eval expectation |
| --- | --- | --- | --- | --- |
| P1 | "Use the most direct kind the change allows: … add one focused test that fails without the fix when the behavior has none." (the reproduce-fix-pass clause and the CI clause survive; see B15) | `## Proof`, line 20 | Duplicate of `make-it-verifiable` (single source of truth): its check ladder and step 3 "New claim: run it before the change; it fails" cover choosing the most direct check and a failing focused test. `## Proof` now points there ("Build proof with `$srulik-toolkit:make-it-verifiable`."). | EE1: "Step 3 is not marked complete until the claim is verified or accepted" and the audit's last check precedes the first `git push`/`gh pr create`. EE2: "The uncovered fix becomes a claim with a check." The `old_skill` expectations graded on `with_skill` catch a regression in proof choice. |

Six merged duplicates are not prunes. The full inventory stayed in the eval
workspace; the surviving text for each is below.

| Row | Base text | Surviving text |
| --- | --- | --- |
| B35, B51, B69 | "Read and follow the installed skill and its required references" in steps 1, 4, and 7 | Boundaries: "Read each named skill and its required references at the phase where it is needed, and follow them" |
| B46 | Reproduce the user's failing workflow and verify that same workflow after the change | `## Proof`, the single source for proof method |
| B48 | Ask only for missing authority, decisions, or inputs | Unattended work ask list, which gains "or an input you need is unavailable" |
| B79 | "A PR being open or CI being green alone does not prove the task is complete" | Opening paragraph: an open PR or green CI is intermediate progress |

## execute-task-end-to-end validator mapping (T5)

Format: `old phrase | part:line | new phrase | B#`. Part and line are at base `6438427`. Every phrase the base validators check in `execute-task-end-to-end/SKILL.md` or `agents/openai.yaml` is listed. The restyle kept each one verbatim on one line, so no validator phrase changed and none was retired; `unchanged (SKILL.md:N)` gives the phrase's line in the new file. Part 3 checks no `execute-task-end-to-end` text: its three references (`3_pr_skills.py:2`, `:3`, `:37`) are in `pr-babysit` files and the linked paths still exist, so part 3 needs no edit. Part 1 gains one entry: `make-it-verifiable` in the dependency loop (W4).

| old phrase | part:line | new phrase | B# |
| --- | --- | --- | --- |
| Creating a PR and driving it to the terminal Definition of Done | 1:73 | unchanged (SKILL.md:8) | B2 |
| **`MERGE READY` without merge authority:** | 1:74 | unchanged (SKILL.md:41) | B20 |
| **`MERGED` with explicit merge authority:** | 1:75 | unchanged (SKILL.md:42) | B21 |
| acceptance criteria pass at the current head | 1:76 | unchanged (SKILL.md:41) | B20 |
| successful required checks, satisfied review requirements, zero unresolved review conversations | 1:77 | unchanged (SKILL.md:41) | B20 |
| no unaddressed actionable human or bot findings | 1:78 | unchanged (SKILL.md:41) | B20 |
| `MERGE READY` is intermediate progress when merging is authorized | 1:79 | unchanged (SKILL.md:42) | B21 |
| These states do not satisfy the Definition of Done | 1:80 | unchanged (SKILL.md:43) | B22 |
| Carry the primary Definition of Done above into the plan | 1:81 | unchanged (SKILL.md:59) | B37 |
| continue immediately to maintenance | 1:82 | unchanged (SKILL.md:65) | B54 |
| the main agent owns the native watch and all fixes | 1:83 | unchanged (SKILL.md:67) | B57 |
| a read-only child filters bounded event batches and never edits or merges | 1:84 | unchanged (SKILL.md:67) | B57 |
| Without merge authority, clean up monitoring and hand back `MERGE READY` | 1:85 | unchanged (SKILL.md:73) | B63 |
| With merge authority, continue immediately to step 6 | 1:86 | unchanged (SKILL.md:73) | B63 |
| Recheck every `MERGE READY` condition immediately before merging | 1:87 | unchanged (SKILL.md:75) | B65 |
| Never bypass checks or branch protection, and never enable auto-merge | 1:88 | unchanged (SKILL.md:83) | B75 |
| on an undocumented host show the capability mapping, label it untested and obtain confirmation | 1:89 | unchanged (SKILL.md:85) | B77 |
| discover existing owners and watches for the exact PR | 1:90 | unchanged (SKILL.md:51) | B25 |
| including standalone babysitters, delegated writers and pending launches | 1:91 | unchanged (SKILL.md:51) | B25 |
| Read every page of relevant ownership records | 1:92 | unchanged (SKILL.md:51) | B25 |
| verify its watch is inactive, its runs and writer tasks have ended with no pending work | 1:93 | unchanged (SKILL.md:52) | B27 |
| retirement prevents further automatic wakes | 1:94 | unchanged (SKILL.md:52) | B27 |
| Preserve unrelated tasks, dirty worktrees and unpublished commits | 1:95 | unchanged (SKILL.md:52) | B29 |
| A mixed-purpose owner or missing stop authority is a blocker | 1:96 | unchanged (SKILL.md:52) | B30 |
| Carry forward narrower authorization | 1:97 | unchanged (SKILL.md:52) | B31 |
| the previous owner's merge authority does not grant this agent merge authority | 1:98 | unchanged (SKILL.md:52) | B31 |
| Register the main watch and start maintenance only after verifying no competing writer remains | 1:99 | unchanged (SKILL.md:53) | B32 |
| Keep the main watch unregistered and perform no PR maintenance writes until the handoff is verified | 1:100 | unchanged (SKILL.md:55) | B33 |
| including when step 4 reuses a PR | 1:101 | unchanged (SKILL.md:67) | B56 |
| Merge authority exists only when the user explicitly asks to merge this task's PR | 1:102 | unchanged (SKILL.md:19) | B7 |
| ## Unattended work | 6:48 | unchanged (SKILL.md:21) | B8 |
| a question in an ordinary message looks like finished work | 6:49 | unchanged (SKILL.md:23) | B8 |
| Ask through the host's question capability so the conversation shows it is waiting | 6:50 | unchanged (SKILL.md:31) | B11 |
| leave the PR unmerged and start the handoff with the question | 6:51 | unchanged (SKILL.md:31) | B12 |
| ## Proof | 6:52 | unchanged (SKILL.md:33) | B14 |
| Proof is evidence you observed in this session | 6:53 | unchanged (SKILL.md:35) | B14 |
| green mocked tests do not prove the user experience | 6:54 | unchanged (SKILL.md:35) | B16 |
| even when a project instruction says to ask first or to leave testing to the user | 6:55 | unchanged (SKILL.md:37) | B17 |
| Instructions about how to test still apply | 6:56 | unchanged (SKILL.md:37) | B18 |
| It does not authorize production changes, data deletion, or bypassing a host approval prompt | 6:57 | unchanged (SKILL.md:37) | B19 |
| Force-push only this task's branch. Before rewriting it, fetch and integrate every remote commit it lacks | 6:58 | unchanged (SKILL.md:83) | B74 |
| Proof must cover every change in the final diff | 6:59 | unchanged (SKILL.md:75) | B66 |
| $srulik-toolkit:create-plan | 1:106 | unchanged (SKILL.md:59) | B34 |
| $srulik-toolkit:create-pr | 1:106 | unchanged (SKILL.md:65) | B50 |
| $srulik-toolkit:pr-babysit | 1:106 | unchanged (SKILL.md:67) | B55 |
| $srulik-toolkit:recap | 1:106 | unchanged (SKILL.md:77) | B69 |
| $srulik-toolkit:make-it-verifiable | 1:106 | added to loop; SKILL.md:35 | W4 (new) |
| 7. **Close with `$srulik-toolkit:recap`.** | 6:108 | unchanged (SKILL.md:77) | B69 |
| Run it for `WAITING`, `BLOCKED`, and `STOPPED` handoffs too | 6:108 | unchanged (SKILL.md:77) | B70 |
| BLOCKED: ownership handoff unverified | 1:150 | unchanged (SKILL.md:55) | B33 |
| host/obsolete tokens absent (T3 Code, Codex, Claude, …) | 1:111 | unchanged; none present | B81 |
| no relative SKILL.md links | 1:109 | unchanged; none present | B82 |
| `allow_implicit_invocation: true` in openai.yaml; no `disable-model-invocation: true` | 1:114 | unchanged | B83 |
| retired lease prohibitions absent | 6:80 | unchanged; none present | B84 |
| question tools / model names absent from core | 6:83 | unchanged; none present | B81 |

Rows: 55. Mutations: 58 (one per mapping row, three for assertion 12).
