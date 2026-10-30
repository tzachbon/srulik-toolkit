# Evaluation artifacts

Adapted from Anthropic's schemas; modified for one canonical layout and
unavailable telemetry. Upstream `ca45fc496a3436251f191354091d557da31c15b5`;
[Apache-2.0](../LICENSE.txt).

```text
iteration-1/
  eval-1-normal/
    eval_metadata.json
    with_skill/run-1/{outputs/,grading.json,timing.json}
    without_skill/run-1/{outputs/,grading.json,timing.json}
```

Use `old_skill` instead of `without_skill` for improvement. Exactly one baseline
configuration is allowed in an iteration. Each eval must have both sides.
Repetition directories use `run-N` with a positive integer; counts may differ and are reported.

## Fixture definition and metadata

The target skill can retain its agreed prompts in `evals/evals.json`:

```json
{"skill_name":"target-name","evals":[{"id":1,"prompt":"A realistic task","expected_output":"Observable outcome","files":[],"expectations":["A verifiable statement"]}]}
```

Each executed eval has `eval_metadata.json` with integer `eval_id`, descriptive
`eval_name`, actual `prompt`, `files`, `expectations`, and the actual `provider`,
`model`, `settings`, `permissions`, `skill_path` and `skill_sha256` when known.
Do not invent unknown identity fields. Record baseline identity separately in
the evidence receipt; an old snapshot is immutable throughout improvement.

## grading.json

```json
{"expectations":[{"text":"A verifiable statement","passed":true,"evidence":"outputs/result.md: section Changes contains the supplied change"}],"summary":{"passed":1,"failed":0,"total":1,"pass_rate":1.0}}
```

Require at least one expectation, boolean `passed`, nonempty text/evidence,
and summary counts/rate consistent with the entries. Missing files, malformed
JSON, non-finite metrics, and inconsistent grades are errors, not skipped runs.
Additional claim/analysis fields may be retained; they do not replace evidence.

## timing.json and execution_metrics

Only include measured fields. Supported `timing.json` fields:
`total_tokens`, `total_duration_seconds`; optionally record native timestamps
and raw duration in the evidence receipt. Supported grading
`execution_metrics.total_tokens` and `timing.total_duration_seconds` are
fallback measurements when the sibling timing file omits them. Values must be
finite nonnegative numbers; tokens must be an integer. Never use
`output_chars` as a token estimate. Missing/null means unknown.

## benchmark.json / benchmark.md

The aggregation helper writes both artifacts. JSON contains `metadata`, raw
`runs`, `run_summary`, and `notes`. `metadata.run_counts` records actual counts
by eval ID and configuration. `runs_per_configuration` appears only when the
repetition count is uniform. Available model/provider identity comes from eval
metadata; absent identity is omitted.

Each summary metric is null when unmeasured, otherwise contains `mean`,
`stddev`, `min`, `max`, `samples`, `fixture_ids`, and `aggregation` set to
`equal_fixture_means`. Mean/stddev are calculated across per-fixture means.
`run_summary.delta` has numeric primary-minus-baseline values or null when a
metric cannot be compared; time/token fixture coverage must match. Raw runs
retain their measured values and expectation evidence. Markdown and the viewer
display unknown values as unavailable, not zero.

## Human feedback

```json
{"status":"complete","reviews":[{"run_id":"eval-1-normal/with_skill/run-1","feedback":"A specific comment or explicit acceptance"},{"run_id":"eval-1-normal/without_skill/run-1","feedback":"Reviewed"}]}
```

Completed feedback includes each displayed run exactly once with string
feedback; reject unknown/duplicate/missing IDs or incomplete status. Import
only from the explicit file selected by the reviewer. Empty comments after
explicit completion indicate no textual objection, not proof of authorship or
human review. The receipt records who supplied feedback and whether synthetic.
