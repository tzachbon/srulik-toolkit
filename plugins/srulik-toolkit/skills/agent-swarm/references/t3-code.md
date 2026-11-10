# Graph mode on T3 Code

This maps the generic steps of graph mode onto T3 Code tools.

| Step | T3 Code |
| --- | --- |
| List runnable models | `orchestrator_capabilities`. Write `[{provider, model, effort}]` to `<run-dir>/candidates.json` and pass it as `pick --candidates <run-dir>/candidates.json` for the providers that can run children. Use each provider instance ID as `provider`, and the effort you intend to use. |
| Read quota | Run `aa-models usage > <run-dir>/usage.json` and pass `--usage <run-dir>/usage.json` to `pick`. Where usage needs root, as on hosts whose secrets helper is root-only, use `sudo -n aa-models usage`. |
| Delegate a task | `delegate_task` with `target.providerInstanceId`, `target.model`, and the effort in `target.options` (the option ID that `orchestrator_capabilities` lists for that model), all taken from `pick`. Use `mode: "wait"` for one task, or `async` for a batch. Ask the child for JSON matching the node's `out`. |
| A child can't start | Record `done` with `failed` and `final: true`. |
| Open the live page | Start `graph.js view <run-dir>` in the background and open the printed URL with `preview_open`. |
| Daily refresh | `schedule_task`, daily: `node <plugin root>/scripts/graph.js refresh`. |
| Weekly thread scoring | `schedule_task`, weekly, read-only. Run `graph.js watermark` and list threads updated after its `since` (not since the last job run, so threads held back behind an undecided one are listed again) with `t3_thread_list` (`allProjects: true`) and read each with `t3_thread_read`. Have the cheapest suitable model label each thread as `{updated, model, kind, signals}`, then run `graph.js score <threads.json>` with the file of labels. Keep no thread text. |

Observed on T3 Code on 2026-11-10: `pr-review.yaml` ran on a real pull request with children on Claude (`claudeAgent`), Kimi (`oh-my-pi`) and Gemini (`antigravity`), picked by `pick` and delegated with `delegate_task`. Quota came from `sudo -n aa-models usage`. The live view was served by `graph.js view`; T3's own preview could not open it because the server runs as root, so a headless Chromium captured it instead.
