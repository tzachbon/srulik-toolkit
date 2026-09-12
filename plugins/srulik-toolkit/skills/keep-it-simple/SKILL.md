---
name: keep-it-simple
description: Choose the smallest correct plan or implementation for the active task. Use when planning or implementation should avoid overengineering and reduce complexity without dropping requirements.
---

# Keep it simple

Understand the affected flow before choosing a plan or change. Trace the current behavior from its public entry point to the observable result or side effect. Read the relevant code, tests, configuration, and contracts. State the current behavior, requested behavior, and narrowest change point before planning or implementation.

Choose the first option in this order that satisfies the request:

1. Use existing code or an existing public interface.
2. Delete duplication or change configuration.
3. Use the standard library, framework, or platform.
4. Use a dependency the project already has.
5. Add the minimum new code.
6. Add a dependency or abstraction only when a concrete constraint requires it or more than one current use needs it.

During planning, remove work that does not advance a current requirement. Prefer existing interfaces and native capabilities, select the smallest approach that satisfies every requirement, and omit speculative phases, abstractions, adapters, options, and tasks.

During implementation, implement one default behavior for the active task. Follow the project's established patterns when they remain clear and fit the requested behavior. Do not add modes, flags, hooks, companion commands, generic frameworks, speculative extension points, or wrappers around a single simple call unless the request requires them.

Simplicity does not reduce the acceptance bar. Preserve requirements, requested behavior, security boundaries, accessibility, error handling, compatibility requirements, agreed tests, and acceptance evidence. If the task uses TDD, keep the agreed public-interface seam and complete one failing test followed by its minimum implementation for each behavior slice. Never skip, weaken, delete, or rewrite an agreed check to make the implementation pass.

After the change, remove code introduced by the task that has no current purpose. Run the smallest verification that proves the requested behavior and its constraints.
