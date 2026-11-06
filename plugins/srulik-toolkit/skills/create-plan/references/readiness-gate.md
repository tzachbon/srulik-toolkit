# Readiness gate

Step 7 of the [create-plan workflow](../SKILL.md#7-pass-the-readiness-gate).

Do not finalize while an unresolved item could materially change scope, approach, sequencing, feasibility, validation, ownership, or risk treatment.

Check:

- Expected outcome: the end state and why it matters are explicit in the conversation, supplied material, or an authoritative source.
- Definition of Done: observable completion evidence and the plan-level acceptance gate are explicit and distinct from task completion.
- Scope: in-scope and out-of-scope boundaries are clear.
- Current state: the relevant starting conditions are understood.
- Prior-art verification: `Context and evidence` satisfies the Verify prior art protocol; unresolved material leads or evidence gaps block dependent decisions.
- Constraints: material technical, organizational, legal, policy, time, cost, compatibility, and resource constraints are known.
- Decisions: major approach choices are settled or intentionally deferred with a resolution path.
- Dependencies: upstream, downstream, external, and approval dependencies are identified.
- Interfaces: handoffs and contracts between workstreams are clear where relevant.
- Validation: every major outcome has evidence that can prove completion.
- Impact and risk: benefits and tradeoffs, inspected blast radius, door classification and recovery limits, and plausible failure scenarios are explicit; material controls map to tasks and unresolved exposure is decided or blocks commitment.
- Ownership: external inputs, approvals, and deferred decisions have owners or resolution sources where ownership matters.
- Execution context: a fresh executor can proceed without rediscovering critical context.
- Skills: planning-time skills were used where needed and execution-time skill handoffs are mapped.
- Skill discovery: the handoff records `COMPLETE`, `INCOMPLETE`, or `SKIPPED: TRIVIAL`, including disciplines, exact searches, candidates, and routing decisions.

Neither item may be deferred. The readiness gate cannot pass while the Expected outcome or Definition of Done is inferred, assumed, deferred, or unresolved.

If the user explicitly forbids questions, run the same grill internally and research everything resolvable. If the Expected outcome or Definition of Done remains unstated, report it as a blocking interaction-dependent uncertainty; do not invent it or finalize the plan. Other non-blocking uncertainties may still be labeled as assumptions under the existing rules. The grill itself is still mandatory.
