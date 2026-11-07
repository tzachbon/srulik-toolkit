# Feedback loops

Adapted from Phase 1 of Matt Pocock's diagnosing-bugs, generalized from bugs to claims. Read this when building the check for a claim.

## Redact

Write `<REDACTED>` in place of every secret in the commands, outputs, and artifacts you show. Pass credentials through environment variables so they stay in the environment, out of the shown invocation. Quote only the lines of a captured artifact that carry the signal. When the redacted output cannot show the result, say so and ask the user.

## The ladder

Take the first rung that observes the claim directly:

1. **Failing test** at the seam that reaches the claim: unit, integration, or end-to-end. Hand a new seam test to `tdd`.
2. **HTTP script** against a running dev server, asserting on status and body.
3. **CLI invocation** with a fixture input, diffing stdout against a known-good snapshot.
4. **Headless browser script** that drives the UI and asserts on the DOM, console, or network.
5. **Replay a captured trace**: save a real request, payload, or event log, then replay it through the code path in isolation.
6. **Throwaway harness**: a minimal subset of the system, such as one service with stubbed dependencies, that exercises the claim with one call.
7. **Property or fuzz loop**: for a claim that must hold for every input, run many random inputs and assert the property.
8. **Bisection harness**: when the claim held at one known state and fails at another, automate "build at state X, check" so `git bisect run` can drive it.
9. **Differential loop**: run the same input through the old and new versions, or two configs, and diff the outputs. It suits invariant claims.
10. **Scripted human step**: the last rung, for a claim only a person can observe. Use the pattern below.

For a claim about docs or config, a check can search for the exact text or load the file with the parser that consumes it.

## Tighten the check

Once a check exists, make it tight:

- **Faster:** cache setup, skip unrelated initialization, and narrow the scope to the claim.
- **Sharper:** assert the specific claim, such as the exact output or status, rather than a clean exit.
- **Deterministic:** pin the clock, seed random generators, isolate the filesystem, and freeze the network.

A two-second deterministic check beats a thirty-second flaky one.

## Non-deterministic claims

Aim for a high, recorded failure rate rather than a single clean reproduction. Loop the trigger, run it in parallel, add load, and narrow timing windows until the rate is high enough to tell red from green. Record the rate in the evidence, for example "fails 48 of 50 runs before the change, 0 of 50 after."

## Scripted human step

Use this when a person must look, listen, or click:

1. Write the numbered steps the person performs, with the exact inputs.
2. State the one observation that decides pass or fail before they look.
3. Ask for the result in a fixed form: pass or fail, plus what they saw or a screenshot path.
4. Record that answer as the check's evidence. Red comes from the same steps against a state where the claim is false: before the change, or a mutated copy.

## When no check can be built

Say so, and list what you tried. Ask the user for one of:

- access to an environment that can observe the claim;
- a redacted captured artifact, such as a log, network capture, or timestamped recording;
- acceptance of the claim as unverified, by name, with the reason.

Until one of those arrives, the claim stays `blocked`.
