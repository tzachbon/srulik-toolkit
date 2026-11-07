# make-it-verifiable skill evidence

Status: authored, validated, mutation-tested, and evaluated against baselines on
Claude Code. Codex model execution verified. One known regression (MV3,
one run) ships as a documented limitation at the owner's direction. Cursor and
T3 Code runtime behavior and Codex native plugin discovery are unverified.

## Source and checks

- Base: `643842727da15efb3c32841522ad4bc0575ff7ab` (`origin/main` at branch start),
  then merged with `origin/main` at `f1f8d3df5b4097b564ecdbf871cec4c4514bde4d` (#58).
- Plugin version `1.16.0`; twenty-six top-level skills.
- File SHA-256 (first 16 hex digits) and size at the reviewed head:

| File | SHA-256 | Bytes |
| --- | --- | --- |
| `skills/make-it-verifiable/SKILL.md` | `24a7df6e172d4d63` | 4934 |
| `skills/make-it-verifiable/references/feedback-loops.md` | `7d7f3e8fbcf73ef8` | 3492 |
| `skills/make-it-verifiable/references/hosts.md` | `196cfa1559b0d2c0` | 2042 |
| `skills/create-plan/SKILL.md` | `a2af1b777b6952f8` | 18081 |
| `skills/execute-task-end-to-end/SKILL.md` | `db17663e3b29c293` | 12831 |
| `scripts/validate/14_make_it_verifiable.py` | `5eaa5030d302f9a7` | 6220 |

- `PYTHONDONTWRITEBYTECODE=1 ./scripts/validate.sh` and `git diff --check`
  passed on macOS. Without the bytecode prefix a second local run fails on
  `__pycache__` files that the skill-creator tests write; CI runs once per clean
  clone and is unaffected.
- New contract `scripts/validate/14_make_it_verifiable.py` pins the skill's
  terms, its references and host table, the create-plan wiring by section, the
  execute-task-end-to-end audit gates, host-agnostic core text, the pinned
  upstream MIT license, and the exact file set.

## Mutation testing

The mutation runner breaks one validator phrase at a time in a scratch copy and
runs `./scripts/validate.sh`. Result on the evaluated text: the unmutated
control passed, and **227 of 227** mutations were rejected with the expected
message.

| Group | Rows | What each row breaks |
| --- | --- | --- |
| Part 14 contract (rows `12.1`–`12.10`) | 52 | one make-it-verifiable term, reference, host row, NOTICE or README token, create-plan section wiring, or execute-task-end-to-end gate |
| create-plan phrases (`M`) | 95 | one create-plan phrase checked by parts 2, 4, and 5, including relocated phrases |
| create-plan reference links (`L01`–`L04`) | 4 | one `references/<name>` link from create-plan `SKILL.md` |
| create-plan assertion 11 (`A11-01`–`A11-10`) | 10 | one make-it-verifiable wiring sentence in its section |
| execute-task-end-to-end (`e2e.*`) | 58 | one phrase checked by parts 1, 6, and 12 |
| Registration (`1.*`, `4.count.*`, `5.*`) | 8 | skill directory, version, skill counts, startup hint, README row |

The first full run reported 213 of 226: the runner mutated only the first file
that matched a phrase, while the validator reads several files joined. After
the runner was fixed to mutate every listed file, all 226 failed as expected.
Row `12.1.25`, for the step 2 sentence added in iteration 2, makes 227. After
the merge with #58, four create-plan rows (M004, M006, M013, M015) were repointed
to the round-continuation phrases #58 put in their place, and the final run on
the merged tree again rejected 227 of 227.

## Restyle inventory and prunes

create-plan and execute-task-end-to-end were rewritten for agents. Each
behavior in the base text got an inventory row (80 for create-plan, 85 for
execute-task-end-to-end) mapped to the place it lives now. Fifteen clauses were
cut as duplicates or no-ops (13 in create-plan, 2 in execute-task-end-to-end),
each tied to an eval expectation that would catch the loss. No validator phrase
changed or was retired. Full ledgers:

- [make-it-verifiable-ledgers.md](make-it-verifiable-ledgers.md): both prune
  ledgers and the execute-task-end-to-end validator mapping.
- [make-it-verifiable-create-plan-mapping.md](make-it-verifiable-create-plan-mapping.md):
  the create-plan validator mapping, including the 37 phrases that moved into
  four new references when `SKILL.md` was split under 20,000 bytes.

## Evaluation

Three fixtures per skill, one run per config. Runs were T3 delegated children on
`claude-haiku-5-5` at medium effort, each in a fresh fixture copy, with fixed
answer sheets for the grill. Baselines: no skill for make-it-verifiable; the
base-commit skill for the two restyled skills. Each run was graded by a Claude
Opus grader and a Sol grader on Codex, and disagreements were settled against
the literal expectation text.

### make-it-verifiable

| Fixture | Iteration 1 with | Iteration 2 with | Without |
| --- | --- | --- | --- |
| MV1 `--json` flag, cron invariant | 5/5 | 5/5 | 2/5 |
| MV2 audit a merged change | 4/4 | 4/4 | 3/4 |
| MV3 "loads faster on mobile" | 3/3 | 1/3 | 1/3 |
| Total | 12/12 | 10/12 | 6/12 |

### create-plan

| Fixture | Iteration 1 with | Iteration 2 with | Old skill |
| --- | --- | --- | --- |
| CP1 | 7/7 | 7/7 (reused) | 3/7 |
| CP2 onboarding outcome claims | 4/5 | 5/5 | 5/5 |
| CP3 declined claim | 3/5 | 3/5 | 3/5 |
| Total | 14/17 | 15/17 | 11/17 |

CP2 expectation 5 was added after iteration 1, from evidence both graders cited:
the with-skill contract marked onboarding outcome claims `verified` by grepping
the plan text. Iteration 2 added one sentence to make-it-verifiable step 2: a
check that reads a description of the change proves only that the text exists.
CP2 passed it in iteration 2.

### execute-task-end-to-end

| Fixture | With | Old skill |
| --- | --- | --- |
| EE1 | 5/5 | 4/5 |
| EE2 | 5/6 | 4/6 |
| EE3 no hosting provider | 3/4 | 2/4 |
| Total | 13/15 | 10/15 |

EE2 with the skill committed a docs file after its audit and merged without
rerunning it, though the skill says to rerun the audit on the final diff. EE3
with the skill wrote a contract plan without following create-plan.

### Grader disagreements

| Run | Expectation | Claude | Sol | Final | Reason |
| --- | --- | --- | --- | --- | --- |
| MV1 without, it1 | invariant cites `cron/report.sh` | fail | pass | pass | claim 4 names the cron output as an invariant |
| MV3 without, it1 | claim reported `blocked` | fail | pass | fail | offered a page-weight proxy as the check |
| MV3 without, it1 | user asked to accept the claim by name | fail | pass | fail | method menu, no scripted step |
| MV3 without, it1 | nothing reported verified | pass | fail | pass | proxy pass labelled not proof |
| MV1, MV2 with, it2 | mutation, diff proof, restore, green | pass | fail | pass | Sol saw truncated activity; the full items show each step |
| CP1 with, it1 | contract before the readiness gate | pass | fail | pass | Sol saw truncated activity; the contract precedes the gate |
| CP2 with, it1 | human checks for outcome claims | fail | pass | pass | observed-ticket and walk-through checks exist |
| CP3 with, it1 | not finalized while the declined claim is `blocked` | pass | fail | fail | the claim was removed, never labelled `blocked` |
| CP3 with, it2 | same | pass | pass | fail | same ruling as iteration 1 |
| EE2 with | audit reruns before `gh pr merge` | pass | fail | fail | a commit landed after the audit |

CP3's expectation assumes a declined claim becomes a `blocked` row. A plan may
also exclude it. Reword it before the next evaluation.

## Host checks

- **Claude Code:** a fresh Haiku child read the skill from the bundle and
  returned the MV1 contract with red evidence on every row (iteration 2, 5/5).
  Unprompted triggering from the installed plugin is checked after release.
- **Codex:** Sol (`gpt-6.1-sol`, high effort) on Codex, macOS, read the skill
  from the bundle in a fresh MV1 copy and returned a contract with red evidence
  on every row: three new claims red against the unchanged `report.py`, three
  invariants proven by scratch-copy mutation with `diff`, restore, and green.
  The work tree was unchanged. Graded 5/5 against the MV1 expectations. Native
  plugin discovery on Codex is unverified.
- **Cursor, T3 Code:** not exercised.

## Human review

The owner reviewed the static review pages for all three skills and left no
feedback. On the MV3 regression the owner chose to ship iteration 2 and record
it here.

## Limitations

- **MV3 regression.** In iteration 2, MV3 labelled a scripted human step
  `planned-red` instead of `blocked` and reported a page-weight proxy
  `verified`. The skill lets a check the host cannot run be `planned-red`, which
  overlaps with `blocked` for a claim with no feasible red-capable check. One
  run per config, so this may be noise.
- **Not re-evaluated after the merge with #58.** create-plan step 10 and its
  launcher now use #58's round-continuation wording, and #58's own split
  references were replaced by this branch's split. Validation and mutations
  cover the merged text; the evals ran on the text before the merge, and the
  `old_skill` baseline is still the base commit.
- One run per config; scores are directional.
- Eval children loaded the owner's global agent instructions and saw the
  installed `1.13.1` plugin in both configs. Prompts banned invoking installed
  skills, and graders checked for it.
- The advisor tool was available to every child and used unevenly: MV3 with
  (it1), MV2 with (it2), EE3 with, CP3 old (it2).
- The CP1 pair, the CP2 old-skill run, the MV without-skill runs, and all EE
  runs were not rerun on the iteration 2 text.
- EE1 configs ran at once and collided on local ports; both were re-verified.
- Graders read activity logs truncated at 2,000 characters per item where the
  full item was not fetched. Token counts were not available.
