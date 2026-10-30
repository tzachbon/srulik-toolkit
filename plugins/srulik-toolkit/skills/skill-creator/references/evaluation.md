# Evaluate and improve

Adapted from Anthropic's skill-creator at
`ca45fc496a3436251f191354091d557da31c15b5`; modified for comparable runs,
truthful measurements, and static review. See [license](../LICENSE.txt).

## Prepare

Use the approved authoring plan and its iteration limit. Resolve the actual
skill path/hash, fixture inputs, expected outputs, provider/model/settings,
permissions, and output workspace. Keep evaluation output outside installed
skill caches and outside the source tree unless durable evidence is requested.
Use [schemas](schemas.md) as the single artifact contract.

For creation compare `with_skill` with `without_skill`: the baseline is a fresh
session with no target skill. For improvement preserve an immutable snapshot of the target before any
edit and compare `with_skill` with `old_skill`. Do not reuse the authoring
conversation as an independent baseline. Use identical inputs, provider,
model, settings and permissions within each pair. A provider/model change is a
new comparison, not a way to turn a failed run into a pass.

## Run and grade

Give every run the prompt, input paths, resolved skill (or explicitly none),
output directory, and expected artifacts. Start paired runs together when
capacity permits; otherwise run fresh isolated sessions serially. Keep child
settings within the parent's authority and record the actual native mapping.
If independent sessions are unavailable, disclose the limitation and do not
claim a comparative benchmark.

Use `iteration-N/eval-ID-name/CONFIG/run-N/outputs/`; keep one shared
`eval_metadata.json` in the eval directory. Save grades beside each `outputs/`
with evidence from actual files. Capture timing/tokens when the host supplies
them; omit unavailable fields. A measured zero is valid, an invented zero is
not. Use scripts for deterministic assertions and [grader](../agents/grader.md)
for judgment requiring evidence. Never grade only the final assistant claim.

From this skill's directory:

```sh
python3 -m scripts.aggregate_benchmark /absolute/path/iteration-1 --skill-name target-name
python3 eval-viewer/generate_review.py /absolute/path/iteration-1 \
  --skill-name target-name --benchmark /absolute/path/iteration-1/benchmark.json \
  --static /absolute/path/review.html
```

The helper uses equal fixture weights after averaging repetitions within each
fixture/configuration. Counts remain visible. Time/token deltas require the
same measured fixture coverage. Variation across fixture means is not
repetition-level uncertainty. Incomplete pairs or invalid grades fail visibly;
repair missing evidence rather than accepting a partial complete-looking run.

## Review before revising

Use the bundled generator, not a custom replacement viewer. It writes a static,
offline file, starts no server, and never stops another process. Present the
actual artifact through the host's supported file/HTML surface. The reviewer
can inspect Outputs and Benchmark and export completed feedback as JSON.
Validate completed feedback against the current run IDs before consuming it:

```sh
python3 eval-viewer/generate_review.py /absolute/path/iteration-1 \
  --feedback /absolute/path/feedback.json
```

Synthetic feedback proves the round trip only. Record actual human acceptance
or requested changes separately. Do not treat blank unsubmitted feedback as
acceptance or claim to have opened an artifact that was merely written.

For covered revisions, execute within the approved plan through
`implement-plan`, produce a new `iteration-N`, rerun affected actual tasks and
baselines, and show the new viewer with `--previous-workspace`. New scope or an
exhausted iteration limit returns to `create-plan` before editing. Read
[analyzer](../agents/analyzer.md) for non-discriminating assertions, variance,
and cost/quality tradeoffs. A tie is a valid observation; never invent a gain.

Before delivery, `implement-plan` invokes `review-pro-max` on authored changes.
Return artifacts, actual evidence, feedback provenance, and limitations.
