---
name: tdd
description: Develop behavior test-first through agreed public interfaces. Use when the user asks for TDD, red-green-refactor, or an integration test backed by an implementation change.
---

# Test-Driven Development

TDD uses a red → green cycle for one behavior slice at a time. This skill defines the test boundary, test quality, and implementation limits for that cycle.

When exploring the codebase, read `CONTEXT.md` (if it exists) so test names and interface vocabulary match the project's domain language, and respect ADRs in the area you're touching.

## What a good test is

Tests verify behavior through public interfaces, not implementation details. Code can change entirely; tests shouldn't. A good test reads like a specification: "user can checkout with valid cart" tells you exactly what capability exists, and it survives refactors because it doesn't care about internal structure.

See [tests.md](tests.md) for examples and [mocking.md](mocking.md) for mocking guidelines.

## Seams: where tests go

A **seam** is the public boundary you test at: the interface where you observe behavior without reaching inside. Tests live at seams, never against internals.

**Test only at agreed seams.** Before writing a test, state the public seam under test and obtain the user's agreement unless the current request already names that seam. Do not write a test against an unconfirmed boundary. Agreement focuses the work on critical behavior instead of incidental implementation details.

Ask: "What's the public interface, and which seams should we test?"

If the interface shape is unsettled, choose the narrowest stable boundary that callers rely on. Keep implementation choices behind that boundary, contain the change in one area, and do not expose internals to make a test easier. Ask one concise question when two reasonable seams would produce different APIs or coverage.

## Anti-patterns

- **Implementation-coupled**: mocks internal collaborators, tests private methods, or verifies through a side channel (querying the database instead of using the interface). The tell: the test breaks when you refactor but behavior hasn't changed.
- **Tautological**: the assertion recomputes the expected value the way the code does (`expect(add(a, b)).toBe(a + b)`, a snapshot derived by hand the same way, a constant asserted equal to itself), so it passes by construction and can never disagree with the code. Expected values must come from an independent source of truth: a known-good literal, a worked example, the spec.
- **Horizontal slicing**: writing all tests first, then all implementation. Bulk tests verify _imagined_ behavior: you test the _shape_ of things rather than user-facing behavior, the tests go insensitive to real changes, and you commit to test structure before understanding the implementation. Work in **vertical slices** instead: one test → one implementation → repeat, each test a **tracer bullet** that responds to what the last cycle taught you.

## Rules of the loop

- **Red before green.** Write one test and run it. Confirm that it fails for the expected missing behavior before changing implementation code.
- **Minimum green.** Add only the implementation needed to pass that test. Run it and confirm the behavior passes.
- **One slice at a time.** Finish one seam, one failing test, and one minimum implementation before starting the next cycle.
- **Refactor after green.** Refactor only when the passing behavior stays unchanged and the agreed tests remain green. Do not add future behavior during cleanup.
