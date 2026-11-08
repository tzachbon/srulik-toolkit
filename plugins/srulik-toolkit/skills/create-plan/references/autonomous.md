# Autonomous grill

Use this mode when the user asks you to be autonomous, to run without them, or to let an agent answer for them, in plain words such as "be autonomous" or "answer on my behalf". It lasts for that request. A bare request not to be asked keeps the internal-grill rule in step 7 of the skill.

The grill still runs in full: research, skill discovery, every wave from `grilling.md`, pushback, re-research, the final adversarial wave, the verification contract and the review rounds. Only the answerer changes. With the user away, nobody catches a skipped step: follow every step of the skill's Workflow in order, meet each `Done when`, and read each reference the skill names. A small task or an autonomous request never exempts a step or shortens the plan.

## Run each wave through a stand-in

1. Build the wave as `grilling.md` describes, including your recommended option for each question.
2. For each wave, launch a fresh stand-in on the strongest available reasoning model at its highest effort, unless the user names a model, and wait for its answers. Set the model and effort explicitly; a default is not a choice. Read [host references](hosts.md) for the exact launch on this host before the first wave.
3. Brief it with:
   - its role: answer as the user would, from their goals, preferences and past choices, not as a planner looking for the best design
   - the wave: each question with its options, tradeoffs and evidence. Leave out the planner's recommended option, so the stand-in judges rather than agrees.
   - every earlier question and the answer it got, so its answers stay consistent
   - where the user's intent lives: the original request and conversation, the user's own instructions and memory, and the repository's guidance. Point to these sources rather than summarizing them. It may read anything else it needs.
   - its limits: it never edits files in the user's workspace or repository, runs no command that changes their state or external state, and contacts no one. It may run experiments in a scratch copy outside the workspace, as planning evidence.
4. For each question it returns an answer (an option or its own wording), the reason with the source of the user's intent it relied on, and a confidence of high, medium or low. When its confidence is low and the decision is a one-way door, it returns `ask the user` instead.
5. Treat each answer as the user's: normalize it, push back in a later wave when it conflicts with evidence or earlier answers, and re-research what it exposes. Record it in the decision ledger as `decided`, with `stand-in (<model>)` in the Evidence/driver column.
6. Ask the user only the `ask the user` items, through the normal question path, and keep the loop moving while you wait.
7. Repeat with the next wave until the grill's completion test passes. That includes the final adversarial wave, so an autonomous grill has at least two waves.

## What the stand-in decides

It answers every grill question. Its answer closes the Outcome and Definition of Done gate. Wherever the skill says to walk the user through findings or ask them to confirm, the stand-in confirms.

These stay with the user: authority beyond the request (production changes, data deletion, spending, publishing, merging, installing a skill), accepting a `blocked` verification row, continuing a stalled review loop or one at a user-set cap, and confirming an undocumented host.

## No independent stand-in

When the host cannot launch a subagent, answer each wave yourself in the stand-in's role under the same rules, and record `No independent stand-in: the planner answered` in the log.

## Log

Add `## Answered on your behalf` to the plan, after `## Decisions and assumptions`, with every column below:

| Wave | Question | Answer | Reason and source | Confidence | Planner's pick | Stand-in |
| --- | --- | --- | --- | --- | --- | --- |

`Planner's pick` is the recommendation withheld from the stand-in, filled in after it answers. `Stand-in` names the model and effort used, or `none` when the planner answered. List each `ask the user` item with the user's answer. The delivery message says the grill was answered on the user's behalf and points to this section.
