# Handoff host mappings

Read before creating the document. These mappings describe capabilities, not
proof that every installation or operating system has been tested.

| Host | Conversation and file capabilities | Explicit invocation |
| --- | --- | --- |
| Claude Code | Use the visible conversation, native file read/write tools, or the shell for temporary file creation and readback. Missing earlier context remains a gap. | `/srulik-toolkit:handoff [focus]`; `disable-model-invocation: true` keeps invocation user-controlled. Suggested skills use the native Skill tool. |
| Codex | Use the visible conversation and available filesystem or shell tools. Read this checkout's source when testing an uninstalled revision. | `$srulik-toolkit:handoff [focus]`; `agents/openai.yaml` sets `allow_implicit_invocation: false`. Load suggested skills through the installed skill mechanism. |
| T3 Code | Use the underlying provider's conversation/filesystem capabilities. If earlier thread history is needed and authorized, use `t3_thread_read` and page it. A path alone does not transfer a file to another machine. | Use the provider's explicit skill invocation above. Do not call `delegate_task` or launch a thread just to write a handoff. |

## Temporary storage

Use the platform's temporary-file capability to create a unique Markdown file;
do not add a project helper. Create it with owner-only access before writing
content: mode `0600` on POSIX or an equivalent private ACL on Windows. Verify
the protection with the host's filesystem capability; stop if it cannot be established.
On POSIX, use `$TMPDIR` when set, otherwise `/tmp`.
On Windows, use `%TEMP%` or the system temporary-path API. Resolve the chosen
directory and ensure it is outside the workspace before writing. If an
environment override points inside the workspace, use another OS temporary
location or report that temporary storage is unavailable. Avoid including
sensitive task text in the filename. Temporary files may be removed by the OS;
return the path immediately and disclose access limits for a different machine.

## Verification limits

Direct execution of the source in a fresh agent session can verify document
content and file placement. It does not prove native command discovery or
implicit-invocation enforcement in an installed plugin. Record the exact host
and platform exercised; leave other configurations, including Cursor and Windows
unless actually tested, unverified. For an unlisted host, map the three required
capabilities, label the mapping untested, and obtain confirmation before acting.
