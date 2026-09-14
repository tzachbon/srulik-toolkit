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

Verify existing paths. Explicitly label new paths as proposed and align them with inspected repository conventions. Resolve discoverable paths during planning. When evidence will only exist during execution, include a bounded discovery action with a completion criterion and block dependent work until it resolves.

Where workstreams depend on one another, specify interfaces:

- Consumes: type, API, schema, event, config, artifact, or behavior required from earlier work
- Produces: type, API, schema, event, config, artifact, or behavior later work relies on

Keep names/signatures consistent across the plan.

## Technical design

Every coding plan must include a `## Technical / Coding` section. Keep it proportional to the change. A simple fix may omit irrelevant subsections; a non-simple change must cover each applicable subsection below.

### High-Level Design

Show the affected system or component boundaries and the relevant data or control flow. Invoke `show-me` during planning and use its smallest useful visual: Mermaid flow, call tree, component tree, file tree, pseudocode, or diff. Do not create a large diagram when a compact code-shape sketch communicates the design.

### System APIs

When the change affects an interface, define the existing and proposed API, schema, event, command, configuration, or error contract. State inputs, outputs, validation, failure behavior, and compatibility impact. Omit this subsection when the change has no meaningful interface surface.

### Low-Level Design

Describe the implementation flow, module and file responsibilities, key algorithms, and boundaries in enough detail to prevent incompatible implementations. Use `show-me` for representative code, pseudocode, a diff, or a file-responsibility sketch. Inspect existing code before proposing new modules or abstractions.

For non-simple changes, apply these implementation constraints:

- Reuse existing modules, standard-library or platform features, and installed dependencies before adding code.
- Split code by cohesive responsibility when that improves readability or testing; move domain behavior out of inline handlers or orchestration code that mixes responsibilities.
- Do not add one-use interfaces, factories, wrappers, or speculative extension points merely to satisfy SOLID terminology.
- Prefer 50-80 lines for each authored production-code file. Tests, generated code, data, and configuration are excluded. A cohesive production file may exceed 80 lines only when the plan records why splitting it would make ownership or readability worse.

## Task boundaries

Use independently testable deliverables. Fold setup, configuration, scaffolding, tests, and documentation into the work item whose outcome needs them unless they form a separately reviewable deliverable.

For TDD-oriented repositories, make the red/green/refactor cycle explicit where it matches existing practice. Do not impose TDD when another validation strategy is more appropriate.

Prefer steps small enough to execute reliably, but do not optimize for arbitrary minute counts. The right boundary is an outcome with its own evidence and review gate.

## Execution detail

Apply `references/detailed-plans.md` from the skill root. Include concrete implementation logic, representative code or patch sketches where useful, specific test cases with expected results, and ordered checkbox steps. Explain relevant current behavior and how the proposed change addresses it. Name specific error and boundary cases instead of delegating their design through phrases such as “handle edge cases.”

For each verification command, state its working directory, prerequisites, expected outcome, and what evidence to retain. Distinguish inspected commands from checks actually executed during planning. Include final integration or end-to-end verification beyond local task checks.

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
- every coding plan includes `## Technical / Coding`, with `show-me` visuals and API detail wherever they are applicable
- non-simple designs reuse existing capabilities, keep responsibilities cohesive, avoid hidden inline domain logic, and justify production files above the 50-80 line preference
