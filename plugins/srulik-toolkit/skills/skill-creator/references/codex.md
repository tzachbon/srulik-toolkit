# Codex mapping

Use `$srulik-toolkit:skill-creator` and verify its source path/content, because
Codex also ships a different built-in `skill-creator`. Invoke the namespaced
`create-plan` and `implement-plan` skills at the required boundaries.

For isolated verification use a disposable native configuration root scoped
only to each process. Register the local checkout with
`codex plugin marketplace add <checkout>`, then install
`codex plugin add srulik-toolkit@srulik-toolkit --json` in that root. Supply
authorized provider credentials through runtime secret references; do not copy
credential stores, replace a shared cache, or mutate the parent environment.

Start a fresh conversation and inspect the actual loaded skill source. Record
provider/model/permissions and assistant/file evidence. Native questions take
precedence where available; otherwise obtain the required response through the
host's conversation surface before dependent writes.

For multi-turn CLI verification, `codex exec --json` supplies the new session
identifier, and `codex exec resume <id> -` accepts a follow-up on stdin. Do not
disable session persistence when testing plan questions and implementation
authorization. A fixture driver's answer is synthetic feedback, not a human's.

Use native subagents for independent target/baseline execution within capacity,
or separate fresh sessions serially. Keep outputs distinct and preserve an old
snapshot. Save only telemetry actually exposed by the selected transport;
unknown token counts remain unknown. Do not estimate tokens from characters.

Display the generated static artifact using the host's supported file/HTML
surface and import the completed feedback download. Do not assume a local
browser/server or another host's tools. Automatic description optimization is
not implemented for this host; the portable workflow remains available.

The mapping is based on inspected CLI help. Runtime verification must identify
the exact platform/version and source receipt; current-session activation,
other operating systems, and other providers are separate unverified scopes.
