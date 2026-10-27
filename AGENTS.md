# Srulik Toolkit agent guide

Edit skill sources under `plugins/srulik-toolkit/skills/` in this repository. Installed plugin caches are runtime copies; verify their version separately when investigating installed behavior.

## Purpose

- Generic across providers and agent harnesses.
- A streamlined path from request to merged change.
- Reusable skills and utilities.

## Context pointers

- Before changing a skill, utility, hook, manifest or validation contract, read [CODING_STANDARDS.md](CODING_STANDARDS.md): host-specific references, where new work fits, and validation contracts.
- Before opening a PR, read [CONTRIBUTING.md](CONTRIBUTING.md) for validation, versions and evidence.
