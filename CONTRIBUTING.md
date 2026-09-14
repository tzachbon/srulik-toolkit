# Contributing to Srulik Toolkit

Srulik Toolkit welcomes fixes, clearer instructions, examples, and focused new
skills. Small pull requests are easier to review and test.

## Before you start

Search the [open issues](https://github.com/tzachbon/srulik-toolkit/issues) for
the problem or idea. Open an issue before a large change so we can agree on the
scope before you spend time implementing it.

## Set up a local checkout

```bash
git clone https://github.com/tzachbon/srulik-toolkit.git
cd srulik-toolkit
./scripts/validate.sh
```

You need Git and Python 3. Claude Code is optional during validation, but when
the `claude` command is available the script also validates both plugin
manifests with Claude Code.

Test the Claude Code plugin from the checkout with:

```bash
claude --plugin-dir ./plugins/srulik-toolkit
```

For Codex, register the checkout as a local marketplace and start a new task:

```bash
codex plugin marketplace add .
codex plugin add srulik-toolkit@srulik-toolkit
```

## Make a focused change

- Keep skill instructions portable across machines and repositories.
- Keep file references relative to the skill directory.
- Add a new abstraction only when more than one real use needs it.
- Do not add private paths, credentials, internal hostnames, or personal data.
- Update the README when users need to know about changed behavior.

A skill belongs under `plugins/srulik-toolkit/skills/<skill-name>/`. Its
`SKILL.md` frontmatter must use the same name as its directory. Add bundled
references beside the skill and link them with relative paths.

If a change modifies the packaged plugin, update all version-bearing manifests
together:

- `.claude-plugin/marketplace.json`
- `plugins/srulik-toolkit/.claude-plugin/plugin.json`
- `plugins/srulik-toolkit/.codex-plugin/plugin.json`

Pull requests that change packaged plugin or marketplace files must also change
`plugins/srulik-toolkit/VERSION`. Documentation-only and CI-only changes do not
require a version bump.

## Validate the change

Run:

```bash
./scripts/validate.sh
git diff --check
```

Then exercise the changed skill in Claude Code, Codex, or both. Include the
prompt you tried and the observed behavior in the pull request.

## Open a pull request

Create a branch from `main`, commit the focused change, and fill in the pull
request template. Explain:

1. What behavior changed.
2. Why the change belongs in this toolkit.
3. How you validated it.

By contributing, you agree that your contribution is licensed under the MIT
License in this repository.

## Community conduct

Read [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Report security concerns through
the private route in [SECURITY.md](SECURITY.md), rather than a public issue.
