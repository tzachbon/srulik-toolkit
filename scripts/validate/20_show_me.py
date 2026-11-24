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
    "`timeline` and `gitGraph` do not support `click`",
    "escape `<` as `&lt;`",
    "forbids remote resources, draw the diagram as inline SVG",
    "the host's viewer or the OS opener",
]:
    if token not in show_me:
        raise SystemExit(f"show-me is missing: {token}")
if "mermaid.esm.min.mjs" in show_me:
    raise SystemExit("show-me must not use the broken ESM Mermaid build (mermaid.esm.min.mjs)")
# Generic core: no harness tool calls or host names.
for token in ["Bash(", "Claude", "Codex", "Cursor", "T3", "t3_", "html_preview", "html_render"]:
    if token in show_me:
        raise SystemExit(f"show-me core must stay host-neutral: {token}")

# Host-specific reference contract (CODING_STANDARDS.md).
# Part 5 already fails when the linked file is missing, so read it directly.
show_me_t3 = (skill_root / "show-me" / "references" / "t3-code.md").read_text(encoding="utf-8")
for token in [
    "## Capability mapping",
    "html_preview",
    "html_render",
    "contentHeight",
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
