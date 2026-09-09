# Engineering planning

Apply these checks to implementation, refactoring, migration, debugging remediation, integration, and software delivery plans.

## Research

Inspect relevant code before grilling when available. Read only enough to establish affected behavior and boundaries:

- repository guidance and local conventions
- entry points and call/data flow
- interfaces, schemas, contracts, and configuration
- tests and fixtures
- existing patterns and nearby implementations
- build, CI, deployment, and observability conventions when relevant
- dependency versions and authoritative API documentation when material
- prior design or architecture decisions that constrain the change

Map affected files/modules before decomposing work. Prefer established patterns unless changing the pattern is an explicit outcome.

## Scope decomposition

Before creating tasks, test whether the requested change spans independent subsystems that can be implemented, validated, reviewed, or shipped separately. If so, split them into subplans or explicitly bounded workstreams with clear contracts.

Do not create one giant task merely because all changes serve one feature.

## File and interface map

For each meaningful engineering unit, record verified paths when known:

- Create: exact path
- Modify: exact path and symbol/region when useful
- Test: exact path or test target
- Configuration/data migration: exact artifact

Do not invent paths. If a path is unknown, include a discovery action defining what must be located and why.

Where workstreams depend on one another, specify interfaces:

- Consumes: type, API, schema, event, config, artifact, or behavior required from earlier work
- Produces: type, API, schema, event, config, artifact, or behavior later work relies on

Keep names/signatures consistent across the plan.

## Task boundaries

Use independently testable deliverables. Fold setup, configuration, scaffolding, tests, and documentation into the work item whose outcome needs them unless they form a separately reviewable deliverable.

For TDD-oriented repositories, make the red/green/refactor cycle explicit where it matches existing practice. Do not impose TDD when another validation strategy is more appropriate.

Prefer steps small enough to execute reliably, but do not optimize for arbitrary minute counts. The right boundary is an outcome with its own evidence and review gate.

## Validation

Prefer executable evidence:

- focused tests for changed behavior
- integration or contract tests across boundaries
- static checks and type checks
- migration dry runs and integrity checks
- performance measurements for performance-sensitive changes
- deployment health checks and rollback verification for production changes

Verification commands must be repository-specific and verified. Never invent commands.

## High-risk changes

For destructive, production, security-sensitive, or data-bearing work include:

- preconditions and approvals
- backup or recovery evidence
- dry-run, shadow, canary, or staged rollout when applicable
- abort thresholds and stop conditions
- rollback or roll-forward procedure
- post-change integrity and health checks
- sensitive-output handling

## Engineering QA

Before finalizing check:

- all requested behavior maps to a task and test/validation
- task order matches interface and data dependencies
- every cross-task symbol or contract is introduced before use
- exact paths/commands are verified
- no task relies on unexplained codebase conventions
- the final state includes cleanup/deprecation work when temporary compatibility paths are introduced
