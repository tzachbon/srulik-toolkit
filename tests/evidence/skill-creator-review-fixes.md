# Skill creator PR review fixes

Review identified four helper/compatibility defects: two-decimal grader rates
were rejected, task deliverables with instrumentation-like basenames were hidden,
feedback downloads revoked their Blob URL immediately, and the Python minimum
was unspecified. Rounded grade inputs now validate within half a percentage
point while benchmark rates still come from exact boolean counts. All files
under `outputs/` are visible. Downloads use an attached anchor and defer URL
cleanup. Helpers and validation require Python 3.10+, with an early validator
error. Focused regressions failed before these fixes and pass afterward.
The download check executes the real export function with a modeled DOM and
queued download; Safari/Firefox execution is not claimed. The Python minimum
check simulates 3.9; an actual older interpreter run is not claimed.

Initial PR CI passed Linux and macOS but failed Windows: automatic CRLF checkout
expanded an existing validator beyond the unchanged 20 KB limit. Git attributes
now keep validation parts LF. A Git checkout with `core.autocrlf=true` reproduced
the original failure, then passed the size checks and targeted validation with
the attribute. Remote Windows verification remains a separate CI gate.

Full repository validation and complete-branch whitespace checks passed after
these changes. All six static viewers were regenerated locally with the final
helpers from preserved actual native data; their complete embedded runs,
benchmarks and previous-iteration content match the earlier reviewed artifacts.
The first refresh omitted the explicit benchmark argument and failed comparison;
corrected generation included the preserved benchmark and passed. Old accepted
artifacts are preserved. No new model evaluations or human acceptance are claimed.
The creator source tree is now
`1e7a4abd681824fc5e612fc6ba1e4c7008e6dbabb927f2da45f679c4608aa5f5`
using the earlier hashing convention; the core skill hash is unchanged. Earlier
activation/cache hashes are historical and do not assert byte identity with these
updated helper sources.
