# Where earlier sessions live

Read this when the handoff points to another session or gives no transcript.
These locations were observed on one Linux host; check that a path exists
before relying on it.

| Host | Find the earlier session | Watch for |
| --- | --- | --- |
| Claude Code | JSONL files in `projects/<cwd-slug>/` under the Claude configuration root (`CLAUDE_CONFIG_DIR`, else `.claude` in the home directory). The slug is the working directory with `/` and `.` replaced by `-`. | Context summaries replace older turns; say which part you saw only as a summary. Subagent transcripts sit in a `subagents/` folder. |
| Codex | `sessions/YYYY/MM/DD/rollout-*.jsonl` under the Codex home (`CODEX_HOME`, else `.codex` in the home directory). User text is in `response_item` entries with role `user`. | Harness and `AGENTS.md` text also arrive as user-role items; skip them. Match the session by its `cwd` in `session_meta`. |
| T3 Code | `t3_thread_search` or `t3_thread_list` to find the thread, then `t3_thread_read` with `view: "activity"`, paging with `afterPosition`. | A provider switch hands over a note such as "Selected 0 intact items". The original thread still holds the history. |

On any other host, including Cursor, this mapping is untested: ask the user to
paste or export the earlier conversation, and work from the repository until
they do.
