# Srulik Toolkit

Srulik Toolkit packages seven skills for Claude Code and Codex in one plugin.
The skills cover project setup, planning, code review, scope control, delegated
work, test-driven development, and small implementations.

## Install

Claude Code:

```bash
claude plugin marketplace add tzachbon/srulik-toolkit
claude plugin install srulik-toolkit@srulik-toolkit
```

Codex:

```bash
codex plugin marketplace add tzachbon/srulik-toolkit
codex plugin add srulik-toolkit@srulik-toolkit
```

Start a new session after installation so the harness loads the skills.

## Skills

| Skill | Use it for |
| --- | --- |
| `to-project` | Turn an idea or existing folder into a project with durable context. |
| `review-pro-max` | Review a local diff, branch, or pull request without changing it. |
| `create-plan` | Research, pressure-test, and write an execution-ready plan. |
| `stay-in-scope` | Recover when work starts to drift outside the requested boundary. |
| `agent-swarm` | Split suitable work across child agents and verify their evidence. |
| `tdd` | Build one behavior at a time through a failing test and minimum implementation. |
| `keep-it-simple` | Find the smallest correct change after understanding the affected flow. |

Invoke a skill by name, such as `$create-plan`, or describe a matching task in
plain language.

## Optional tools

`review-pro-max` can use the GitHub CLI for pull requests. It can also run
CodeRabbit when the user opts in and the command is installed and authenticated.
CodeRabbit may send source outside the local machine, so the skill does not run
it by default.

`to-project` can search public skill catalogs when the user asks. It never
installs extra skills without explicit authorization.

`agent-swarm` uses the child-agent controls exposed by the active harness. When
none exist, it reports that limitation and keeps eligible work serial.

## Update or remove

Claude Code:

```bash
claude plugin marketplace update srulik-toolkit
claude plugin update srulik-toolkit@srulik-toolkit

claude plugin uninstall srulik-toolkit@srulik-toolkit
claude plugin marketplace remove srulik-toolkit
```

Codex:

```bash
codex plugin marketplace upgrade srulik-toolkit

codex plugin remove srulik-toolkit@srulik-toolkit
codex plugin marketplace remove srulik-toolkit
```

## Development

Run the repository checks from the root:

```bash
./scripts/validate.sh
```

The repository uses the MIT License. [NOTICE.md](NOTICE.md) records the source
and optional-tool notices.
