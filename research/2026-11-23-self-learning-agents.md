# Self-learning for agent toolkits: what works

## Answer

The setups with the best evidence share five traits:

1. They capture signals cheaply, with no model call.
2. They count recurrence before acting.
3. They edit small itemized entries and never rewrite a whole file.
4. They inject the lesson text at session start.
5. They prune entries that stop being used.

Fully automatic instruction-file growth is the main failure mode. Native memory already exists in Codex and Claude Code, so a toolkit should cover what native memory does not: lessons about skills and about the project's own steering files.

## Findings

### Existing tools

- **claude-reflect** ([repo](https://github.com/BayramAnnakov/claude-reflect)): a hook on every prompt matches corrections ("no, use X", "actually", "remember:") and queues them. The user reviews the queue with `/reflect` and applies, edits or skips each entry. Approved lessons sync to `CLAUDE.md`, `AGENTS.md` and skill files. A semantic pass during review filters regex false positives and handles other languages.
- **claude-evolve** ([repo](https://github.com/taipm/claude-evolve)): hooks capture corrections, build or test failures, and the fix that follows a failure. A recurring signal increments one record's `seen_count` instead of adding a line. Lessons seen at least twice become auto-loaded skills. Top lessons are injected at session start by content, not by count. Lessons unseen for 60 days go stale and are archived at 120. Its README rates a `CLAUDE.md` import as the most reliable channel and auto-loaded skills as the least, because the model decides whether to invoke them.
- **claude-learn** ([repo](https://github.com/OutcomefocusAi/claude-learn)): scores rules with evidence, validates them across sessions, and lets unconfirmed rules decay.

### Native harness memory

- **Codex** ([docs](https://learn.chatgpt.com/docs/customization/memories), [pipeline README](https://github.com/openai/codex/blob/main/codex-rs/memories/README.md)): memory generation runs in the background when a root session starts. It only processes sessions that have been idle long enough, skips sub-agent and short sessions, and redacts secrets. A second phase consolidates memories, ranked by usage count, and prunes memories unused beyond `max_unused_days`. It is off by default. The docs say required team guidance belongs in `AGENTS.md`, and memory is "a helpful recall layer".
- **Cursor**: forum and Reddit users report that auto-generated memories were captured arbitrarily, ignored in later chats, stored per machine, or applied out of context ([forum 1](https://forum.cursor.com/t/memories-and-rules/121348), [forum 2](https://forum.cursor.com/t/saved-memories-in-cursor-and-their-viability/128968), [Reddit](https://www.reddit.com/r/cursor/comments/1mwgdp9/are_cursor_rules_and_memories_even_working/)).

### Research

- **ACE, Agentic Context Engineering** ([arXiv 2510.04618](https://arxiv.org/abs/2510.04618)): when a model rewrote the whole accumulated context at each step, the context collapsed from 18,282 tokens to 122, and accuracy fell from 66.7 to 57.1, below the 63.7 baseline with no adaptation. ACE stores context as itemized bullets with helpful and harmful counters. A reflector extracts lessons, a curator writes small deltas, and deterministic code merges them, followed by de-duplication.

### Practitioner reports

- An `AGENTS.md` had reached 755 lines before its author cut it to 61. It then grew back to 341 lines across six files, because agents kept docs in sync with code and nothing ever prompted a deletion. The author keeps a line only if a mistake would be silent or expensive, checks would not catch it, and no nearby comment already says it ([JonahDevs](https://jonahdevs.com/posts/agents-md-grew-back/)).
- An audit of a 714-line `AGENTS.md` found 40% needed at session start, 49% reference material, and 12% deletable. The author links longer files to worse adherence ([Vic Valenzuela](https://vic.valenzuela.is/blog/claude-md-as-constitution/)).

## Inferences

- A headless review after every session spends a model run on sessions that have nothing to teach. Codex runs at the next session start, filtered to idle sessions, and batches several sessions per run.
- Requiring a repeat before acting is the main defense against one-off or wrong lessons. Both claude-evolve and Codex rank by recurrence or usage.
- Auto-applied lessons need a decay path. Otherwise the override file grows the same way the `AGENTS.md` files above did.
- Toolkit-level memory entries would duplicate native memory in Codex and Claude Code. Skill overrides and project PRs are the gap.

## Gaps

- No source measured end-to-end task improvement for the coding-agent plugins. Their claims come from their own READMEs.
- The Cursor evidence is user reports, not documentation of how Cursor memories are generated.
- Two searches hit Exa rate limits. Reflexion, ExpeL and similar papers were not read for this report.
