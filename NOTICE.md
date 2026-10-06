# Source notices

Srulik Toolkit adapts skills supplied by Zach Bonfil: `to-project`,
`review-pro-max`, `create-plan`, `stay-in-scope`, `agents-swarm`, and `tdd`.
Zach Bonfil authorized their publication in this repository under the MIT
License. The `to-project` source already carried the MIT License and a 2024
Zach Bonfil copyright notice.

Copyright (c) 2024 Zach Bonfil

`agent-swarm` is the portable published name for the supplied `agents-swarm`
workflow. `keep-it-simple` was written for this toolkit.

The `pr-babysit` skill combines the supplied `pr-babysit` and `autopilot`
workflows. The supplied `resolving-merge-conflicts` and `fix-ci` workflows were
also adapted for this toolkit under the repository's MIT License. `research`
was written for this toolkit using the public Claude Explore documentation as
design input.

CodeRabbit is an optional external tool mentioned by `review-pro-max`. It is
not bundled with this repository and remains subject to its own terms.

The `stop-slop` skill adapts the Stop Slop skill by Hardik Pandya
(https://hvpandya.com), distributed under the MIT License. Its original notice
and full license terms are retained in
[`skills/stop-slop/LICENSE`](plugins/srulik-toolkit/skills/stop-slop/LICENSE).

Copyright (c) 2025 Hardik Pandya

The additional `stop-slop` editing guidance was written for this toolkit.
The merged guidance uses new wording and does not publish an `unslop` alias.

The `show-me` skill is copied from HumanLayer's public skills repository
(https://github.com/humanlayer/skills) at revision
`3c2629142c5d437428269b1b722b08c0b87f574d` under the MIT License. Its original
license is retained in
[`skills/show-me/LICENSE`](plugins/srulik-toolkit/skills/show-me/LICENSE).

Copyright (c) 2026 HumanLayer

The `retro` skill adapts Matt Pocock's public `retro` skill
(https://github.com/mattpocock/skills) at revision
`4588b32ecab9ecc9fc8cc6b6c5e7d675b6004b0d` under the MIT License. Its original
license is retained in
[`skills/retro/LICENSE`](plugins/srulik-toolkit/skills/retro/LICENSE).

Copyright (c) 2026 Matt Pocock

The adaptation adds portable session access, explicit evidence requirements,
and scoped implementation guidance without requiring another installed skill.

The `create-plan` impact and risk assessment takes inspiration from the door
and blast-radius concepts in [Matt Pocock's `pr` skill](https://github.com/mattpocock/skills/blob/6fd947921b935b7e1e69293a200400f0fdd5c15f/skills/engineering/pr/SKILL.md).
The planning guidance uses new wording and adds task-linked failure scenarios,
detection signals, stop conditions, and recovery limits.
