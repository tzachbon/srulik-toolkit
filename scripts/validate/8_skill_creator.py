"""Validate skill-creator contracts; also runnable alone with the repository root."""
from pathlib import Path
import ast
import re
import subprocess
import sys

creator_repo = Path(sys.argv[1])
creator_root = creator_repo / "plugins/srulik-toolkit/skills/skill-creator"
creator_contracts = {
    "SKILL.md": ["Invoke `create-plan` for every skill creation or edit, including small changes.",
                 "then invoke `implement-plan` with that plan", "do not write target skill files then",
                 "Do not recursively restart the top-level skill", "New requirements or feedback outside",
                 "Invoke `review-pro-max`", "human feedback status", "license: Apache-2.0"],
    "references/authoring.md": ["inside the approved `implement-plan` task", "observable success",
                                "Preserve an existing skill's name"],
    "references/evaluation.md": ["immutable", "fresh isolated sessions serially", "Never grade only",
                                 "equal fixture weights", "before revising", "Synthetic feedback proves"],
    "references/schemas.md": ["run-N", "exactly once", "equal_fixture_means", "Missing/null means unknown",
                              "fixture coverage must match", "boolean `passed`"],
    "references/hosts.md": ["Claude Code", "Codex", "T3 Code", "unverified"],
    "references/claude-code.md": ["/srulik-toolkit:skill-creator", "POSIX-only", "PYTHONPATH",
                                  "--num-workers 1", "--report none", "does not authorize applying it", "--add-dir"],
    "references/codex.md": ["$srulik-toolkit:skill-creator", "built-in", "isolated", "exec resume",
                            "unknown token counts remain unknown"],
    "references/t3-code.md": ["orchestrator_capabilities", "target.options", 'isolation: "worktree"',
                              "obey each delegated task's `next`", "html_preview", "html_render"],
}
for creator_relative, creator_phrases in creator_contracts.items():
    creator_text = " ".join((creator_root / creator_relative).read_text(encoding="utf-8").split())
    for creator_phrase in creator_phrases:
        if creator_phrase not in creator_text:
            raise SystemExit(f"skill-creator {creator_relative} missing contract: {creator_phrase}")

creator_core = (creator_root / "SKILL.md").read_text(encoding="utf-8")
creator_forbidden = ["Claude", "Codex", "Cowork", "delegate_task", "orchestrator_capabilities",
                     "watch_pull_request", "total_tokens", "duration_ms", "PYTHONPATH"]
for creator_token in creator_forbidden:
    if creator_token in creator_core:
        raise SystemExit(f"host-specific skill-creator core instruction: {creator_token}")

creator_license = (creator_root / "LICENSE.txt").read_text(encoding="utf-8")
for creator_token in ["Apache License", "Version 2.0", "Copyright 2026 Anthropic, PBC"]:
    if creator_token not in creator_license:
        raise SystemExit(f"skill-creator retained license missing: {creator_token}")
creator_notice = (creator_repo / "NOTICE.md").read_text(encoding="utf-8")
for creator_token in ["ca45fc496a3436251f191354091d557da31c15b5", "skills/skill-creator/LICENSE.txt", "Apache"]:
    if creator_token not in creator_notice:
        raise SystemExit(f"skill-creator NOTICE missing: {creator_token}")

creator_helpers = ["scripts/__init__.py", "scripts/utils.py", "scripts/aggregate_benchmark.py",
                   "scripts/run_eval.py", "scripts/run_loop.py", "scripts/improve_description.py",
                   "scripts/generate_report.py", "eval-viewer/generate_review.py"]
for creator_relative in creator_helpers:
    creator_file = creator_root / creator_relative
    creator_text = creator_file.read_text(encoding="utf-8")
    if creator_text and ("Apache-2.0" not in creator_text or "Modified" not in creator_text):
        raise SystemExit(f"missing imported helper attribution/modification notice: {creator_relative}")
    for creator_node in ast.walk(ast.parse(creator_text)):
        creator_modules = ([alias.name for alias in creator_node.names] if isinstance(creator_node, ast.Import)
                           else [creator_node.module] if isinstance(creator_node, ast.ImportFrom) else [])
        for creator_module in creator_modules:
            if creator_module and creator_module.split('.')[0] not in sys.stdlib_module_names | {"scripts"}:
                raise SystemExit(f"skill-creator helper requires a third-party dependency: {creator_module}")
for creator_name in ["quick_validate.py", "package_skill.py"]:
    if (creator_root / "scripts" / creator_name).exists():
        raise SystemExit(f"unsupported dependency-bearing helper bundled: {creator_name}")

creator_viewer = (creator_root / "eval-viewer/generate_review.py").read_text(encoding="utf-8")
for creator_token in ["HTTPServer", "_kill_port", "os.kill", "serve_forever", "webbrowser.open"]:
    if creator_token in creator_viewer:
        raise SystemExit(f"static viewer contains a server/process side effect: {creator_token}")
for creator_relative in ["eval-viewer/viewer.html", "assets/eval_review.html", "scripts/generate_report.py"]:
    creator_text = (creator_root / creator_relative).read_text(encoding="utf-8")
    if re.search(r'(?:src|href)=[\"\x27]https?://', creator_text) or 'fetch(' in creator_text:
        raise SystemExit(f"offline review loads remote resources: {creator_relative}")

for creator_path in (creator_repo / "scripts/validate").glob("[0-9]*_*.py"):
    if creator_path.stat().st_size >= 20_000:
        raise SystemExit(f"validation part exceeds 20 KB: {creator_path.name}")

subprocess.run([sys.executable, str(creator_repo / "scripts/test-skill-creator.py")],
               check=True, timeout=90)
