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
