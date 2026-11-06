# Review-only extraction from UI UX Pro Max; no upstream runtime dependency.
import hashlib

ui_review_dir = skill_root / "ui-ux-review"
ui_review = (ui_review_dir / "SKILL.md").read_text(encoding="utf-8")
ui_checklist = (ui_review_dir / "references" / "checklist.md").read_text(encoding="utf-8")
ui_metadata = (ui_review_dir / "agents" / "openai.yaml").read_text(encoding="utf-8")
ui_license = (ui_review_dir / "LICENSE").read_text(encoding="utf-8")
ui_host = (ui_review_dir / "references" / "t3-code.md").read_text(encoding="utf-8")
ui_sources = {
    "ui-ux-pro-max.md": "ea087c341bfb5b23195c7302027268ede86da802554c18a5c4896a6017b439f9",
    "quick-reference.md": "0609bc7c89dacb40472465d8fc14257b56b2c43439660fc8d6fa3b8c022e1876",
    "pro-rules.md": "d28442d61c310b49c054a4ea736f89fb3008beebdbbc38c4b3a540b8f7fadf23",
}
for ui_name, ui_digest in ui_sources.items():
    ui_source = (ui_review_dir / "references" / ui_name).read_text(encoding="utf-8")
    if hashlib.sha256(ui_source.encode("utf-8")).hexdigest() != ui_digest:
        raise SystemExit(f"UI UX upstream reference differs from the pinned source: {ui_name}")

# unslop by Damir Sokolovsky, CC BY 4.0, pinned at 1d13095e4bef6ad6c74f1dd828d84c4ba309a4dc.
unslop_dir = ui_review_dir / "references" / "unslop"
unslop_sources = {
    "unslop.md": "9e49b2ff7643fa09729e8665890a18f6bfa58a82e6fcbba330da38136ccdc393",
    "LICENSE": "9ba9550ad48438d0836ddab3da480b3b69ffa0aac7b7878b5a0039e7ab429411",
    "references/effects.md": "ded4f679e22843a8f68860e6cda0396fa8b8fa27202400e08337143b485c86a4",
    "references/refs.md": "12a70ce17d574914ea69eb0809e5a9605de044df1b66619159c6d0b38d6b8353",
    "references/signs.md": "6250d3c222c2aaa4ef4f31557d99d249e5be86d8720cd1157df14798caf1c8c4",
    "references/tokens.md": "988b754612b3e2d42d87b1bbaca0b4a61f3e07a2b2eef782d3614e8fdb6db5b0",
    "references/visuals.md": "7247da579d2d95ace1e051b867c757bd1e05aa02f3ab8dea0ead4cd4bf14d7d7",
    "references/refs/beacon-engraving.webp": "44e7680e9c944f03c8fe45df999bdf74077a106925a8189eebf89e751e306e5b",
    "references/refs/meadow-3d.webp": "84f526b68021a06fc6d32f162406fab6cc8074da1ef76d2ae4530e1b58219b14",
    "references/refs/story-dashboard-frames.webp": "cfbf837e40b7626d5a5789dbce54f5c197aab303aa350d13a042048310717137",
    "references/refs/unslop-dashboard-after.webp": "48067794f86b43dab20515b3810f245d67bff05d10bfa83c0f5885bee93cea52",
    "references/refs/unslop-hero-after.webp": "92b2d796c5b6116a2039f5ca2b0f3edf700c92b41846b11b9501a4e32f72af6e",
}
unslop_files = {p.relative_to(unslop_dir).as_posix() for p in unslop_dir.rglob("*") if p.is_file()}
if unslop_files != set(unslop_sources):
    raise SystemExit(f"unslop reference must bundle exactly the pinned files: {sorted(unslop_files ^ set(unslop_sources))}")
for unslop_name, unslop_digest in unslop_sources.items():
    if hashlib.sha256((unslop_dir / unslop_name).read_bytes()).hexdigest() != unslop_digest:
        raise SystemExit(f"unslop reference differs from the pinned source: {unslop_name}")

ui_contracts = {
    "review scope": (ui_review, [
        "Return findings without editing files or redesigning",
        "not keyboard, screen reader, responsive, or runtime verification",
        "unexercised runtime effects remain hypotheses",
        "stop before purchases, messages, deletion",
        "list untested checks as evidence gaps",
        "Severity follows demonstrated user impact",
        "smallest recommended repair",
        "a concrete verification step",
        "No substantiated findings in the reviewed scope",
        "`review-pro-max`", "`create-plan`", "`implement-plan`",
        "[review checklist](references/checklist.md)",
        "[original UI UX Pro Max skill](references/ui-ux-pro-max.md)",
        "[full rule set](references/quick-reference.md)",
        "[professional UI checks](references/pro-rules.md)",
        "archived source references; this skill's review workflow and checklist take precedence",
        "Upstream generation/search tooling and datasets are not bundled or authorized by this review",
        "Review every user story in the agreed scope",
        "Create a coverage matrix before reviewing",
        "Never silently drop a story",
        "Always look for the project's design system first",
        "Record the authoritative baseline",
        "Open and visually inspect every in-scope supplied or generated design image",
        "file existence, screenshot metadata",
        "do not count as looking at the image",
        "Compare each applicable screen against the design-system baseline",
        "Source-only inspection is partial review and cannot satisfy visual acceptance",
        "For every in-scope story in an implemented interface, exercise its acceptance criteria",
        "Coverage is `COMPLETE` only when every applicable criterion",
        "any in-scope `UNVERIFIED` or `BLOCKED` criterion makes coverage `INCOMPLETE`",
        "Never turn passing code checks into a visual pass",
        "Label design-only acceptance explicitly",
        "[host mapping](references/t3-code.md)",
        "On a harness with no documented reference, show the capability mapping",
        "label it untested, and obtain user confirmation before proceeding",
        "[unslop skill](references/unslop/unslop.md)",
        "[signs of slop](references/unslop/references/signs.md)",
        "[finished references](references/unslop/references/refs.md)",
        "causes another demonstrated user impact",
        "otherwise treat it as an optional aesthetic suggestion, omitted unless requested",
        "snapshot or story tooling; they are not bundled or authorized by this review",
        "references/unslop/LICENSE", "Damir Sokolovsky",
    ]),
    "review criteria": (ui_checklist, [
        "## Story and design-system coverage",
        "Account for every in-scope story and acceptance criterion",
        "Directly inspect each required design image and implementation render",
        "Verify reuse of established component variants",
        "## Accessibility and input", "4.5:1 for normal text",
        "3:1 for large text (at least 18pt, or 14pt bold)",
        "exempts text in inactive components, decorative or incidental text, and logotypes",
        "exempts inactive components, unmodified user-agent controls",
        "whose particular presentation is essential to the information conveyed",
        "24×24 CSS px",
        "44×44pt", "48×48dp", "criterion exception", "200%", "320 CSS px",
        "## Task clarity, navigation, and interaction",
        "## Forms, feedback, and recovery",
        "## Layout, typography, and visual consistency",
        "## Motion and perceived performance", "## Charts and data displays",
        "password managers and paste", "reduced motion",
        "programmatically associated", "lost content or functionality",
        "[signs of slop](unslop/references/signs.md)",
        "Report a sign as a defect only with a user impact or design-system conflict",
    ]),
    "review metadata": (ui_metadata, [
        'display_name: "UI UX Review"', "$ui-ux-review",
        "every in-scope user story", "actual design images",
    ]),
    "review host": (ui_host, [
        "## Capability mapping", "view_image", "preview_status", "preview_open",
        "Never use `preview_*`", "device_list", "device_open",
        "question tool", "unique task session ID",
        "full application acceptance remain unverified",
        "Other provider backends on T3 Code follow the core's untested-host gate",
        "A backend with its own mapping in this folder",
        "show the capability mapping, label it untested, and obtain user confirmation before proceeding",
    ]),
    "review license": (ui_license, [
        "MIT License", "Copyright (c) 2024 Next Level Builder",
        "Permission is hereby granted", "THE SOFTWARE IS PROVIDED",
    ]),
    "review attribution": (notice, [
        "Next Level Builder", "ui-ux-review/LICENSE",
        "28b3b8dee8c976df4fa3e94aed4e092ad43fcb03",
        "references/ui-ux-pro-max.md",
        "references/quick-reference.md", "references/pro-rules.md",
        "Damir Sokolovsky", "1d13095e4bef6ad6c74f1dd828d84c4ba309a4dc",
        "CC BY 4.0", "references/unslop/LICENSE",
        "snapshot and story scripts and examples are not bundled",
    ]),
}

for ui_label, (ui_text, ui_tokens) in ui_contracts.items():
    for ui_token in ui_tokens:
        if " ".join(ui_token.split()) not in " ".join(ui_text.split()):
            raise SystemExit(f"UI UX {ui_label} contract missing: {ui_token}")

ui_forbidden = [
    "CLAUDE_PLUGIN_ROOT", "CODEX_HOME", "playwright-cli", "use_figma",
    "preview_open", "preview_status", "view_image", "device_list",
    "device_open", "device_screenshot", "--design-system", "scripts/search.py",
]
for ui_token in ui_forbidden:
    if ui_token in ui_review or ui_token in ui_checklist:
        raise SystemExit(f"UI UX review must stay portable and review-only: {ui_token}")

if {p.name for p in ui_review_dir.iterdir()} != {"SKILL.md", "LICENSE", "agents", "references"}:
    raise SystemExit("UI UX review must not bundle upstream tooling or catalogs")
if "allow_implicit_invocation: false" in ui_metadata:
    raise SystemExit("UI UX review must remain discoverable")
if "ui-ux-review" not in (root / "CODING_STANDARDS.md").read_text(encoding="utf-8"):
    raise SystemExit("UI UX review must be mapped to the toolkit workflow")
