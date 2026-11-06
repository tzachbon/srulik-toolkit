# Planning brief and decision ledger

Keep a working brief throughout planning. It is a tracking aid; the final plan expands its execution-relevant content:

- Objective
- Expected outcome: the explicit end state the plan must produce and why it matters
- Definition of Done: the explicit observable evidence and acceptance gate that proves the outcome was achieved
- Verified facts
- User decisions
- Inferences
- Assumptions
- Constraints and invariants
- Scope and non-goals
- Candidate approaches
- Material unknowns
- Dependencies
- Risks and irreversible choices
- Validation expectations
- Sources consulted
- Skills discovered, invoked, or likely needed later

Assess impact and risk before settling consequential decisions, scaling detail to the stakes, and carry the assessment into the final plan:

- **Impact:** describe the intended before/after outcome, who benefits, and material costs or tradeoffs. Use evidence or agreed success criteria; label estimates and unknowns.
- **Blast radius:** trace affected callers, users, data, services, or workflows, including indirect dependencies and failure propagation. State which boundaries inspection supports and where coverage remains unknown; a small diff does not prove a small blast radius.
- **Door:** classify consequential decisions or steps as a **two-way door** (the prior state can be restored at acceptable cost) or a **one-way door** (irreversible or impractical to reverse). Explain why, identify the point of commitment, and describe recovery prerequisites and limits. A code revert does not restore deleted data or undo public commitments or external side effects. Classify mixed plans per step, so a one-way step stays visible under an overall reversible label.
- **What can go wrong:** run a pre-mortem against the proposed approach. Describe plausible failure scenarios, their consequences, detection signals, prevention, stop conditions, and recovery or explicitly accepted residual exposure. Link each material control to the task where it operates. Distinguish evidence-backed risks from hypotheses; name specific scenarios rather than generic risk lists or invented probability scores.

Resolve factual gaps through research and judgment calls through the grill. A one-way door needs stronger evidence before commitment; use a staged experiment when it can resolve uncertainty or reduce exposure. Record unavailable recovery as a limit rather than promising rollback.

Maintain a decision ledger for consequential branches:

```text
Decision | Status | Evidence/driver | Choice | Rationale | Revisit trigger
```

Use statuses: `open`, `decided`, `resolved`, `deferred`, `contradicted`.

## Evidence discipline

Use precise provenance:

- Verified: directly supported by inspected evidence.
- Decided: explicitly chosen by the user or an authoritative decision record.
- Inferred: reasoned from evidence but not directly stated.
- Assumed: necessary for planning but unresolved.

Convert material assumptions into research or grill questions whenever possible. Treat secondary sources as pointers when primary evidence is available. Record source freshness when it materially affects the plan.
