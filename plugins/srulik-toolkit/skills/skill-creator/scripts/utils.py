# Modified for Srulik Toolkit: portable evaluation contracts, isolated execution, and offline review. Upstream ca45fc496a3436251f191354091d557da31c15b5; Apache-2.0.
"""Shared utilities for skill-creator scripts."""

import json
from pathlib import Path
import re



def parse_skill_md(skill_path: Path) -> tuple[str, str, str]:
    """Parse a SKILL.md file, returning (name, description, full_content)."""
    content = (skill_path / "SKILL.md").read_text()
    lines = content.split("\n")

    if lines[0].strip() != "---":
        raise ValueError("SKILL.md missing frontmatter (no opening ---)")

    end_idx = None
    for i, line in enumerate(lines[1:], start=1):
        if line.strip() == "---":
            end_idx = i
            break

    if end_idx is None:
        raise ValueError("SKILL.md missing frontmatter (no closing ---)")

    name = ""
    description = ""
    frontmatter_lines = lines[1:end_idx]
    i = 0
    while i < len(frontmatter_lines):
        line = frontmatter_lines[i]
        if line.startswith("name:"):
            name = line[len("name:"):].strip().strip('"').strip("'")
        elif line.startswith("description:"):
            value = line[len("description:"):].strip()
            # Handle YAML multiline indicators (>, |, >-, |-)
            if value in (">", "|", ">-", "|-"):
                continuation_lines: list[str] = []
                i += 1
                while i < len(frontmatter_lines) and (frontmatter_lines[i].startswith("  ") or frontmatter_lines[i].startswith("\t")):
                    continuation_lines.append(frontmatter_lines[i].strip())
                    i += 1
                description = " ".join(continuation_lines)
                continue
            else:
                description = value.strip('"').strip("'")
        i += 1

    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", name) or len(name) > 64:
        raise ValueError("skill name must be a lowercase hyphenated identifier of at most 64 characters")
    return name, description, content


def workspace_root(path):
    path = Path(path).absolute()
    if path.is_symlink() or not path.is_dir():
        raise ValueError("workspace must be a real directory")
    return path.resolve()


def safe_path(root, path, *, exists=True):
    """Confine reads/writes and reject symlinks below the selected workspace."""
    candidate = Path(path).absolute()
    resolved = candidate.resolve(strict=exists)
    if not resolved.is_relative_to(root):
        raise ValueError("path escapes the selected workspace")
    for ancestor in (candidate, *candidate.parents):
        if ancestor.is_symlink():
            raise ValueError("symlink inputs are not supported")
        if ancestor.resolve() == root:
            break
    return resolved


def read_json(root, path):
    def reject_constant(_value):
        raise ValueError("non-finite JSON is not supported")
    return json.loads(safe_path(root, path).read_text(encoding="utf-8"),
                      parse_constant=reject_constant)
