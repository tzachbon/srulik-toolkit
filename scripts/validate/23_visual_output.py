# Visual output lint: ban ASCII/Unicode box-and-arrow diagrams in non-mermaid fences,
# while exempting file trees (├── / └── ). Verified against committed red/green fixtures
# and every skill Markdown file.

_VIS_UNI = re.compile(r"[─-╿←-⇿▲▶►▼◀]")
_VIS_ASCII = re.compile(r"(?<![=<-])-{1,}>|\+-{2,}\+|<-{2,}|\|-{2,}")
_VIS_TREE = re.compile(r"^[+\- ]?[ \t│]*[├└]── ")
_VIS_PLAIN = {"", "text", "txt", "plain", "plaintext"}


def find_ascii_diagrams(text):
    hits = []
    fence = None
    for lineno, line in enumerate(text.splitlines(), 1):
        # CommonMark: a backtick fence's info string has no backtick, so ```x``` is an inline span.
        opened = re.match(r"^\s*(`{3,}|~{3,})\s*([\w+-]*)[^`]*$", line)
        if opened and fence is None:
            fence = (opened.group(1), opened.group(2).lower())
            continue
        if fence and line.strip().startswith(fence[0]) and line.strip().strip(fence[0][0]) == "":
            fence = None
            continue
        if not fence or fence[1] == "mermaid":
            continue
        tree = _VIS_TREE.match(line)
        line_rest = line[tree.end():] if tree else line
        if _VIS_UNI.search(line_rest) or (fence[1] in _VIS_PLAIN and _VIS_ASCII.search(line_rest)):
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
assert not find_ascii_diagrams("```\n├── src/\n│   └── main.py\n```\n"), "file tree flagged"
assert find_ascii_diagrams("```mermaid``` blocks render.\n```text\n+---+ --> +---+\n```\n"), "inline span opened a fence"

for md_path in sorted(skill_root.rglob("*.md")):
    hits = find_ascii_diagrams(md_path.read_text(encoding="utf-8"))
    if hits:
        first_line, first_text = hits[0]
        raise SystemExit(f"banned ASCII/Unicode diagram in {md_path.relative_to(root)}:{first_line}: {first_text}")

print("Visual output lint passed")
