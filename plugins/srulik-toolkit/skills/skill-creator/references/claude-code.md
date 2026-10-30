# Claude Code mapping

Use `/srulik-toolkit:skill-creator`, then the namespaced `create-plan` and
`implement-plan` skills. Verify the resolved skill source; another installed
`skill-creator` may have the same short name. Native questions and permission
handling take precedence over prose prompts when available.

Load an isolated local plugin with `claude --plugin-dir <plugin-root>` and a
process-scoped disposable `CLAUDE_CONFIG_DIR`. Do not copy credential stores or
edit a shared installation. Use authorized runtime credential references if
needed. Verify the actual paths and source identity in a fresh conversation.

For restricted print-mode verification, include the trusted creator directory
with `--add-dir` and authorize its Python helper commands. Direct absolute
entry points, such as `python3 -B <creator>/scripts/aggregate_benchmark.py`, avoid
environment-prefixed module invocations. Keep generated files in the scratch
project. A denied command stops the affected task until its scope is explicitly
resolved; retain the denial in the evidence.

For multi-turn noninteractive tests, use a unique `--session-id` and resume it
with `--resume`; retain session persistence until plan questions and explicit
implementation authorization are answered. Record provider/model/permission
mode and assistant/file evidence. A printed skill list alone is not invocation.

Use native child agents for paired target/baseline tasks when allowed. A fresh
serial session is the fallback when concurrency is unavailable. Keep mutable
outputs in separate directories. Save token/timing information only when
actually exposed; do not assume another host's notification fields.

Generate the static review file; show it using the available artifact surface
or return its clickable absolute path. Import explicit completed feedback.
Do not launch the upstream viewer server. Runtime support must be labeled with
the actual platform/version exercised; source validation is a separate check.

## Optional description optimization

This optional path is Claude-specific and currently POSIX-only because the
upstream trigger runner uses `select` on process pipes. It is never automatic
and is not a prerequisite for portable authoring/evaluation. Missing CLI,
model, authentication or platform support skips this capability explicitly.

Use a disposable project containing its own `.claude` directory. Keep cwd there
so temporary commands cannot land in a parent real project. Set process-scoped
`PYTHONPATH` to the absolute bundled skill directory, then run:

```sh
python3 -m scripts.run_loop --eval-set /absolute/path/trigger-evals.json \
  --skill-path /absolute/path/target-skill --model <available-claude-model> \
  --num-workers 1 --max-iterations 3 --report none \
  --results-dir /absolute/path/optimizer-results
```

Select an actual supported Claude model; do not pass the parent model identifier
from another provider. Review the mixed positive/negative trigger queries with
the human first, using [the template](../assets/eval_review.html). Substitute
plain-text placeholders with HTML escaping and embedded JSON with script-context
escaping (`<` as `\u003c`); do not splice raw query text into script or markup.

The runner returns a proposed description chosen using held-out scores; it does
not authorize applying it. Every application is a skill edit and must be covered
by `create-plan` and executed through `implement-plan`. Use bounded calls and
report test-set size/limits. Do not imply that a live optimizer run was verified
when only local fake tests ran.

With holdout enabled, provide at least two queries per present trigger class so
each class retains training and test examples. For smaller sets, add queries or
explicitly use `--holdout 0`; this disables held-out evaluation.

Capability mapping is based on inspected CLI help and upstream source. Live
creation/improvement evidence, when available, belongs in the repository's
verification receipt; unexercised configurations remain unverified.
