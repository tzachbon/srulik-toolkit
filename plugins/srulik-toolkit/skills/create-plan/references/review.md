# Review planning

Apply these checks to code review, design review, document review, audit, quality assessment, readiness review, and compliance-style evaluation.

## Define the review contract

Before reviewing, establish:

- review target, scope, and version
- governing requirements, rubric, policy, spec, or acceptance criteria
- review depth and sampling strategy
- severity model
- evidence required for a finding
- pass/fail, approval, or escalation thresholds
- exclusions and known limitations
- whether remediation design or only findings are in scope

## Research

Inspect the artifact and authoritative criteria before grilling. If the review concerns a change, inspect both the changed surface and the dependencies needed to understand impact.

Do not infer a defect from preference. Establish the criterion first.

## Review hypotheses

Organize work around review dimensions, requirements, or plausible failure modes rather than arbitrary file/document order when that improves coverage.

For each review workstream include:

- target surface
- criterion or falsifiable question
- evidence to inspect
- method/checks
- finding format
- severity/decision rule
- remediation verification when applicable

## Skeptical verification

For consequential findings, attempt to falsify the finding before finalizing it:

- look for counterevidence
- test whether the issue is actually reachable/applicable
- distinguish theoretical risk from demonstrated impact
- check whether another control already satisfies the criterion
- verify scope and severity

Do not weaken a finding merely because remediation is inconvenient.

## Findings discipline

Require every material finding to include:

- evidence
- impact
- severity or priority
- violated criterion or rationale
- confidence/limitations when evidence is incomplete
- recommended remediation when remediation is in scope

Separate:

- factual defect
- risk
- missing evidence
- preference or improvement suggestion

Do not manufacture findings to fill categories.

## Coverage

Maintain an internal matrix:

```text
Criterion/dimension | Evidence inspected | Result | Finding/blocker
```

Every governing requirement or review dimension must be assessed, explicitly excluded, or blocked with a reason.

## Completion

A review plan is complete when:

- governing criteria are traceable to review work
- sampling limitations are explicit
- severity and decision rules are operational
- material findings require evidence
- remediation verification is planned where needed
- coverage gaps cannot masquerade as a pass
