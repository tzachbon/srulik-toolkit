# Smart Ralph plugin fit for Srulik Toolkit

## Conclusion

Yes, Smart Ralph can technically be distributed from this repository, but it should **not be copied into the `srulik-toolkit` plugin**. The smallest sound integration is to treat it as an independently installed companion plugin and, if desired, document that installation in Srulik Toolkit.

Smart Ralph already publishes separate, self-contained plugin payloads for Claude Code and Codex. Its Codex instructions install `ralph-specum` directly from the `smart-ralph` marketplace, and its Codex marketplace points to `./plugins/ralph-specum-codex` ([Codex README](https://github.com/tzachbon/smart-ralph/blob/ac7251a0a056b51435192443775f3cbbc4675cba/plugins/ralph-specum-codex/README.md#L19-L28), [Codex marketplace](https://github.com/tzachbon/smart-ralph/blob/ac7251a0a056b51435192443775f3cbbc4675cba/.agents/plugins/marketplace.json#L1-L19)). Repackaging that payload here would duplicate an already installable product and make this repository responsible for synchronizing upstream releases.

## Evidence

### Smart Ralph is a plugin, not a single drop-in skill

At upstream `main` revision `ac7251a0a056b51435192443775f3cbbc4675cba`, the Codex manifest declares a plugin named `ralph-specum`, a skills directory, and a `Stop` hook ([Codex manifest](https://github.com/tzachbon/smart-ralph/blob/ac7251a0a056b51435192443775f3cbbc4675cba/plugins/ralph-specum-codex/.codex-plugin/plugin.json#L1-L13)). Its documented surface contains fifteen related skills and a task execution hook, rather than one isolated workflow ([Codex README](https://github.com/tzachbon/smart-ralph/blob/ac7251a0a056b51435192443775f3cbbc4675cba/plugins/ralph-specum-codex/README.md#L64-L86)). The Claude marketplace likewise publishes `ralph-specum` as its own plugin ([Claude marketplace](https://github.com/tzachbon/smart-ralph/blob/ac7251a0a056b51435192443775f3cbbc4675cba/.claude-plugin/marketplace.json)).

The upstream license is MIT and permits copying, modification, merging, and redistribution provided the copyright and license notice are retained ([Smart Ralph license](https://github.com/tzachbon/smart-ralph/blob/ac7251a0a056b51435192443775f3cbbc4675cba/LICENSE#L1-L18)). Licensing therefore does not block bundling; maintenance and product boundaries do.

### Srulik Toolkit currently enforces one plugin with twelve skills

At Srulik Toolkit revision `cb4e6ae9e0622085ec698e9f33b1ab1b5d851394`, both marketplace catalogs expose exactly one local plugin named `srulik-toolkit` ([Codex marketplace](https://github.com/tzachbon/srulik-toolkit/blob/cb4e6ae9e0622085ec698e9f33b1ab1b5d851394/.agents/plugins/marketplace.json#L1-L20), [Claude marketplace](https://github.com/tzachbon/srulik-toolkit/blob/cb4e6ae9e0622085ec698e9f33b1ab1b5d851394/.claude-plugin/marketplace.json#L1-L20)). The validator explicitly requires exactly the twelve named skill directories and exactly the `srulik-toolkit` catalog entry ([validator](https://github.com/tzachbon/srulik-toolkit/blob/cb4e6ae9e0622085ec698e9f33b1ab1b5d851394/scripts/validate.sh#L17-L35), [catalog checks](https://github.com/tzachbon/srulik-toolkit/blob/cb4e6ae9e0622085ec698e9f33b1ab1b5d851394/scripts/validate.sh#L70-L95)). Adding Smart Ralph as another bundled plugin would therefore require intentional changes to both catalogs and the validator; copying its skills into the existing plugin would additionally require renaming the documented twelve-skill product throughout the manifests, README, startup hint, and validation rules.

Srulik Toolkit also promises portable workflows and requires relative bundled resources ([contribution rules](https://github.com/tzachbon/srulik-toolkit/blob/cb4e6ae9e0622085ec698e9f33b1ab1b5d851394/CONTRIBUTING.md#L37-L54)). Smart Ralph's Codex automation is a Bash `Stop` hook that invokes `jq` and Python ([hook](https://github.com/tzachbon/smart-ralph/blob/ac7251a0a056b51435192443775f3cbbc4675cba/plugins/ralph-specum-codex/hooks/stop-watcher.sh#L1-L24)). That is materially different from Srulik Toolkit's deliberately static, cross-shell `SessionStart` hint and would need separate portability review rather than silent incorporation ([validator](https://github.com/tzachbon/srulik-toolkit/blob/cb4e6ae9e0622085ec698e9f33b1ab1b5d851394/scripts/validate.sh#L97-L131)).

### The workflows overlap

Smart Ralph turns a feature request into research, requirements, design, tasks, and implementation artifacts ([Codex README](https://github.com/tzachbon/smart-ralph/blob/ac7251a0a056b51435192443775f3cbbc4675cba/plugins/ralph-specum-codex/README.md#L1-L18)). Srulik Toolkit already packages research, planning, project setup, agent delegation, TDD, review, and scope control as independently invoked skills ([Srulik Toolkit README](https://github.com/tzachbon/srulik-toolkit/blob/cb4e6ae9e0622085ec698e9f33b1ab1b5d851394/README.md#L42-L59)). Bundling Smart Ralph into the same plugin would create two competing orchestration surfaces without evidence that users need them coupled.

## Recommended path

Keep Smart Ralph independently versioned and installed from its own marketplace:

```text
codex plugin marketplace add tzachbon/smart-ralph \
  --sparse .agents/plugins \
  --sparse plugins/ralph-specum-codex
codex plugin add ralph-specum@smart-ralph
```

These are Smart Ralph's first-party Codex installation commands ([source](https://github.com/tzachbon/smart-ralph/blob/ac7251a0a056b51435192443775f3cbbc4675cba/plugins/ralph-specum-codex/README.md#L19-L28)). If Srulik Toolkit wants to endorse the pairing, add only an “Optional companion plugins” README note linking to those upstream instructions. This avoids vendored code, duplicated versioning, license-notice work, validator expansion, and hook coupling.

## If “part of the toolkit” is a hard requirement

The clean version would be a **second marketplace entry with a separately vendored plugin directory**, not merged skills. That requires, at minimum:

1. Vendor both upstream platform payloads or define a deliberate platform-specific distribution policy.
2. Retain Smart Ralph's MIT copyright and license notice.
3. Add the second entry to both marketplace formats and revise validation that currently demands one entry.
4. Add an explicit upstream-version update process and validate both hooks on every supported platform.
5. Resolve naming and user guidance where Smart Ralph's end-to-end orchestration overlaps Srulik Toolkit skills.

No evidence found in either repository establishes a plugin-dependency mechanism that would let the `srulik-toolkit` plugin install Smart Ralph transitively. Without such a supported mechanism, documentation plus independent installation is the only option that avoids vendoring. This is an evidence gap rather than proof that no future marketplace feature can support dependencies.
