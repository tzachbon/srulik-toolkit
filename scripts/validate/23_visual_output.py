# Visual output lint: ban ASCII/Unicode box-and-arrow diagrams in non-mermaid fences,
# while exempting file trees (├── / └── ). Verified against committed red/green fixtures
# and every skill Markdown file.

_VIS_UNI = re.compile(r"[─-╿←-⇿▲▶►▼◀]")
_VIS_ASCII = re.compile(r"(?<![=<-])-{2,}>|\+-{2,}\+|<-{2,}|\|-{2,}")
_VIS_TREE = re.compile(r"^[+\- ]?[ \t\u00a0│]*[├└]──[ \u00a0]")
# A tree spacer line holds only vertical rails, e.g. "│   │".
_VIS_TREE_SPACER = re.compile(r"^[+\- ]?[ \t\u00a0│]*│[ \t\u00a0│]*$")
_VIS_PLAIN = {"", "text", "txt", "plain", "plaintext", "ascii"}


def find_ascii_diagrams(text):
    hits = []
    stack = []  # open fences; a markdown/md fence may hold nested fences
    for lineno, line in enumerate(text.splitlines(), 1):
        stripped = line.strip()
        top = stack[-1] if stack else None
        # A bare closer closes the outermost fence it matches and every fence nested inside it.
        closer = next((i for i, f in enumerate(stack) if stripped.startswith(f[0]) and stripped.strip(f[0][0]) == ""), None)
        if closer is not None:
            del stack[closer:]
            continue
        # CommonMark: a backtick fence's info string has no backtick, so ```x``` is an inline span.
        opened = re.match(r"^\s*(`{3,}|~{3,})\s*([\w+-]*)[^`]*$", line)
        nests = top and top[1] in ("markdown", "md") and opened and (opened.group(1)[0] != top[0][0] or len(opened.group(1)) < len(top[0]))
        if opened and (top is None or nests):
            stack.append((opened.group(1), opened.group(2).lower()))
            continue
        if not top or top[1] == "mermaid" or _VIS_TREE_SPACER.match(line):
            continue
        tree = _VIS_TREE.match(line)
        line_rest = line[tree.end():] if tree else line
        if _VIS_UNI.search(line_rest) or (top[1] in _VIS_PLAIN and _VIS_ASCII.search(line_rest)):
            hits.append((lineno, line))
    return hits


fixtures_dir = root / "scripts" / "fixtures"
ascii_fixture = fixtures_dir / "recap-ascii.md"
mermaid_fixture = fixtures_dir / "recap-mermaid.md"
for fixture in [ascii_fixture, mermaid_fixture]:
    if not fixture.is_file():
        raise SystemExit(f"missing visual-output fixture: {fixture.relative_to(root)}")

ascii_hits = find_ascii_diagrams(ascii_fixture.read_text(encoding="utf-8"))
if not ascii_hits:
    raise SystemExit("scripts/fixtures/recap-ascii.md must trigger at least one ASCII/Unicode diagram violation")

mermaid_text = mermaid_fixture.read_text(encoding="utf-8")
if "```mermaid" not in mermaid_text:
    raise SystemExit("scripts/fixtures/recap-mermaid.md must contain a mermaid fenced block")
mermaid_hits = find_ascii_diagrams(mermaid_text)
if mermaid_hits:
    raise SystemExit(f"scripts/fixtures/recap-mermaid.md must pass visual lint, got: {mermaid_hits}")

# Regression cases from review: tree prefix must not exempt the rest of the line; an inline
# ```span``` at line start must not open a fence.
assert find_ascii_diagrams("```\n├── PR #101 ──▶ PR #102\n```\n"), "tree prefix exempted an arrow"
assert find_ascii_diagrams("```\n└── PR #103 --> PR #104\n```\n"), "tree prefix exempted ASCII arrow"
assert not find_ascii_diagrams("```\n├── src/\n│   ├── a/\n│   │\n│   └── main.py\n```\n"), "file tree flagged"
assert find_ascii_diagrams("```ascii\n+---+ --> +---+\n```\n"), "ascii fence skipped"
assert not find_ascii_diagrams("```mermaid\nflowchart LR\n  A --> B\n```\n"), "mermaid fence flagged"
assert find_ascii_diagrams("````markdown\n```text\n+---+ --> +---+\n```\n````\n"), "nested text fence skipped"
assert not find_ascii_diagrams("````markdown\n```mermaid\nA ──▶ B\n```\n````\n"), "nested mermaid fence flagged"
assert find_ascii_diagrams("```markdown\n````mermaid\n```\n```text\n+---+ --> +---+\n```\n"), "longer inner opener swallowed outer closer"
assert not find_ascii_diagrams("````markdown\n```mermaid\nA --> B\n````\nprose ──▶ here\n"), "outer closer left inner fence open"
assert not find_ascii_diagrams("```markdown\n````text\n+---+ --> +---+\n````\n"), "longer same-char opener nested"
assert not find_ascii_diagrams("```diff\n+├── a/\n+│   │\n-│   │\n```\n"), "diff spacer flagged"
assert not find_ascii_diagrams("```text\nfn parse(s) -> Ast\n```\n"), "pseudocode return arrow flagged"
assert not find_ascii_diagrams("```text\n.\n├──\u00a0src\n│\u00a0\u00a0 └──\u00a0main.py\n```\n"), "tree output with no-break spaces flagged"
assert find_ascii_diagrams("```mermaid``` blocks render.\n```text\n+---+ --> +---+\n```\n"), "inline span opened a fence"

for md_path in sorted(skill_root.rglob("*.md")):
    hits = find_ascii_diagrams(md_path.read_text(encoding="utf-8"))
    if hits:
        first_line, first_text = hits[0]
        raise SystemExit(f"banned ASCII/Unicode diagram in {md_path.relative_to(root)}:{first_line}: {first_text}")

print("Visual output lint passed")
