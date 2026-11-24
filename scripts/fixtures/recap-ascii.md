# Recap

**Goal:** Ship four stacked PRs across two waves for the billing export pipeline.

```text
Wave 1:
+--------------+     +---------------+
| PR #101 schema | --> | PR #102 query |
+--------------+     +---------------+
                            |
                            v
Wave 2:
+--------------+     +---------------+
| PR #103 csv  | --> | PR #104 cli   |
+--------------+     +---------------+
```

**Done:**
- Merged PR #101 (export schema) and PR #102 (cursor query) in wave 1.
- Opened PR #103 (CSV writer) and PR #104 (CLI flag) in wave 2.

**Now:** Waiting on CI for PR #104.
