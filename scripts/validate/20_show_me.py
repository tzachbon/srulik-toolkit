import re
# show-me: host-capability routing, Mermaid default, ASCII diagram ban, classic SRI Mermaid,
# and host-specific T3 Code reference contract.
show_me = (skill_root / "show-me" / "SKILL.md").read_text(encoding="utf-8")
for token in [
    "## Output by host capability",
    "Inline-HTML host",
    "deliver every chat-reply visual",
    "Mermaid-fence host",
    "Plain Markdown host",
    "Chat vs. file scope",
    "say it is untested, and use it only after the user confirms",
    "Visuals written into files",
    "No ASCII diagrams",
    "never draw flows, timelines, pipelines, or PR stacks with ASCII box-drawing or arrow art",
    "Reserve text trees (`├──`, `└──`) strictly for file, component, or call-tree shape",
    "](references/t3-code.md)",
    "Use Mermaid by default for relationships",
    "Keep text trees, pseudocode, and diffs for code shape and changes",
    "about 12 nodes",
    "```mermaid\nflowchart",
    "```mermaid\nstateDiagram-v2",
    "```mermaid\nsequenceDiagram",
    "```mermaid\ntimeline",
    "```mermaid\ngitGraph",
    "```mermaid\nerDiagram",
    '<pre class="mermaid">',
    "mermaid@12.3.0/dist/mermaid.min.js",
    "sha384-HHW54r639fK42Ip0coGF3mz8oSiGn0eEoWNTLs75X7H63pLSDBa0Tqs0RwGmLlXE",
    'crossorigin="anonymous"',
    'securityLevel: "antiscript"',
    "prefers-color-scheme: dark",
    "mermaid.run()",
    'a.setAttribute("target", "_blank")',
    'a.setAttribute("rel", "noopener noreferrer")',
    "both at the end of `<body>` after every `<pre class=\"mermaid\">`",
    'work under `securityLevel: "antiscript"` in `flowchart` and `classDiagram`',
    "including `timeline`, `gitGraph` and `stateDiagram-v2`, do not reliably support `click`",
    "replace each line break with a space and write `<` `>` `\"` `;` `#` `&` `%` as Mermaid entity codes `#lt;` `#gt;` `#quot;` `#59;` `#35;` `#38;` `#37;` in a single pass",
    "only from `https://` URLs you built yourself, and drop any other scheme",
    "never in unquoted labels, `|...|` edge labels, or identifiers",
    "use synthetic identifiers matching `[A-Za-z0-9_]+`",
    "forbids remote resources, draw the diagram as inline SVG",
    "the host's viewer or the OS opener",
]:
    if token not in show_me:
        raise SystemExit(f"show-me is missing: {token}")
# Live T3 probe: stateDiagram-v2 `click` is a parse error and gantt yields no link.
if re.search(r"work under `securityLevel: \"antiscript\"` in [^;]*?(`stateDiagram|`gantt)", show_me):
    raise SystemExit("show-me must not claim Mermaid click links work in stateDiagram or gantt")
# Every securityLevel in show-me is antiscript; loose or strict would re-enable or break click links.
if re.findall(r'securityLevel:\s*"(\w+)"', show_me) != ["antiscript"] * show_me.count("securityLevel:"):
    raise SystemExit('show-me must set securityLevel: "antiscript" everywhere')
notice = " ".join((root / "NOTICE.md").read_text(encoding="utf-8").split())
for token in ["host-capability output routing, ASCII-diagram ban,", "classic SRI HTML Mermaid rendering guidance, and host reference in `show-me`"]:
    if token not in notice:
        raise SystemExit(f"NOTICE.md is missing show-me attribution: {token}")
if "mermaid.esm.min.mjs" in show_me:
    raise SystemExit("show-me must not use the broken ESM Mermaid build (mermaid.esm.min.mjs)")
# Generic core: no harness tool calls or host names.
for token in ["Bash(", "Claude", "Codex", "Cursor", "T3", "t3_", "html_preview", "html_render"]:
    if token in show_me:
        raise SystemExit(f"show-me core must stay host-neutral: {token}")

# show-me: HTML goes to the host's hosted page when one exists; the Claude Code mapping lives in a reference.
for token in [
    "when a host reference documents a host-native private, shareable hosted page",
    "when you revise a visual you already published in this conversation, update that page",
    "Do not publish when the user asked for the file itself",
    "say it is untested, and publish only after the user confirms",
    "Otherwise, or when publishing fails, write it to a collision-safe, OS-managed temporary path",
    "Hosted-page references: [references/claude-code.md](references/claude-code.md)",
]:
    if token not in show_me:
        raise SystemExit(f"show-me is missing: {token}")
if "`Artifact`" in show_me or "artifact-design" in show_me:
    raise SystemExit("show-me core must stay host-neutral: name the hosted page, not the tool")
show_me_claude = skill_root / "show-me" / "references" / "claude-code.md"
if not show_me_claude.is_file():
    raise SystemExit("show-me is missing references/claude-code.md")
show_me_claude_text = show_me_claude.read_text(encoding="utf-8")
for token in [
    "`Artifact`",
    "`artifact-design`",
    "same `file_path`",
    "leave out the core's Mermaid scripts",
    "add the core's pinned Mermaid scripts back before opening the local file",
    "Without that tool, or when a publish is refused, use the core fallback",
    "When the system prompt lists no scratchpad, use the core fallback",
    "skip `quickstart` and the Artifact types",
    "When the caller forbids remote resources, also skip web fonts and CDN scripts",
    "do not also open the local file",
    "Never publish a page that imitates",
    "Observed with Claude Code",
]:
    if token not in show_me_claude_text:
        raise SystemExit(f"show-me Claude Code reference is missing: {token}")
# Host-specific reference contract (CODING_STANDARDS.md).
# Part 5 already fails when the linked file is missing, so read it directly.
show_me_t3 = (skill_root / "show-me" / "references" / "t3-code.md").read_text(encoding="utf-8")
for token in [
    "## Capability mapping",
    "html_preview",
    "html_render",
    "contentHeight",
    "pass that same absolute `path` to both calls",
    "Never start a local HTTP/viewer server",
    "never use `preview_*` tools",
    "no background color, no outer card",
    "height: 100%",
    "--background",
    "--foreground",
    "--chart-1",
    "mermaid@12.3.0/dist/mermaid.min.js",
    "antiscript",
    "## Observed live",
    "mermaid.esm.min.mjs",
]:
    if token not in show_me_t3:
        raise SystemExit(f"show-me/references/t3-code.md is missing: {token}")
