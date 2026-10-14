# Planning host mappings

These mappings preserve the existing state and delivery instructions. They do not
establish end-to-end verification of the review loop. On another harness, show the
available capability mapping, label it untested, and obtain confirmation before
using it.

## Codex, including Codex in T3 Code

- State: prefer the runtime-provided per-plugin data directory. Otherwise use
  `plugins/data/srulik-toolkit-srulik-toolkit` under the Codex user configuration root.
- Delivery: determine Plan Mode only from active system or developer instructions.
  In Plan Mode, also emit the complete plan verbatim inside exactly one
  `<proposed_plan>` block. The native block is authoritative when Plan Mode forbids
  file writes; do not attempt a write then. Outside Plan Mode, return the temporary
  file link without a `<proposed_plan>` block.
- T3 delegated reviews: call `delegate_task` again for every round, carrying the
  original brief, prior findings, responses, and unresolved objections. Retain each
  `taskId` and use a distinct `clientRequestId` per round, stable across retries.
  The returned `childThreadId` is storage, not the target for another review round.

## Claude Code

- State: prefer the runtime-provided per-plugin data directory. Otherwise use
  `srulik-toolkit` under the Claude user configuration root (`CLAUDE_CONFIG_DIR`
  when set).
- Delivery: honor the active runtime's planning and file-write restrictions.
  Return the complete plan's temporary file link when writes are permitted;
  otherwise return the complete plan in the conversation.
