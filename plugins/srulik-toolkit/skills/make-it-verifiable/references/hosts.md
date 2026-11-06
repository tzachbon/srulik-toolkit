# Make it verifiable host mappings

Read before building checks. These mappings describe capabilities, not proof that every installation or operating system has been tested.

| Host | Run commands | Scratch copy outside the workspace | Ask the user | Status |
| --- | --- | --- | --- | --- |
| Claude Code | Shell tool. Plan mode runs no commands, so contract mode records `planned-red` rows. | Copy the repository under `$TMPDIR` (or `/tmp`) with the shell. | Native question tool, or a plain question in the reply. | unverified until an observed run is recorded |
| Codex | Shell tool. A read-only sandbox runs reads only, so contract mode records `planned-red` rows. | Copy under the OS temporary directory when the sandbox allows writes there. | A plain question in the reply. | Model execution unverified until an observed run is recorded; native plugin discovery unverified |
| T3 Code | The underlying provider's shell. Plan interaction mode is read-only. | The provider's shell, under the OS temporary directory. | The provider's question capability. Children without a user answer from their brief or keep rows `blocked`. | unverified |
| Cursor | Agent terminal commands. Ask mode runs no commands. | The agent terminal, under the OS temporary directory. | A plain question in the reply. | unverified |

## Temporary storage

On POSIX, use `$TMPDIR` when set, otherwise `/tmp`. On Windows, use `%TEMP%`. Resolve the chosen directory and confirm it is outside the workspace before copying.

## Verification limits

Reading this skill's source in a fresh session can verify the contract it returns. It does not prove native skill discovery or implicit invocation in an installed plugin. Record the host and platform you exercised and leave the others unverified. For an unlisted host, map the three capabilities, label the mapping untested, and act after the user confirms.
