# Srulik Toolkit agent guide

Purpose: generic across providers and agent harnesses; a streamlined path from request to merged change; reusable skills and utilities.

Edit skill sources under `plugins/srulik-toolkit/skills/`. Installed plugin caches are runtime copies; check their version separately when investigating installed behavior.

- Creating or modifying a skill, including small edits: use [`srulik-toolkit:skill-creator`](plugins/srulik-toolkit/skills/skill-creator/SKILL.md) and its required `create-plan` and `implement-plan` handoffs.
- Changing a skill, utility, hook, manifest or validation contract: first read [CODING_STANDARDS.md](CODING_STANDARDS.md).
- Opening a PR: first read [CONTRIBUTING.md](CONTRIBUTING.md) (validation, versions, evidence).
