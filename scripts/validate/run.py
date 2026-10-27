"""Run the validation parts in order in one shared namespace, so later parts
reuse the paths and skill text earlier parts read. Usage: run.py <repo root>."""
import pathlib

namespace = {"__name__": "__main__"}
for part in sorted(pathlib.Path(__file__).parent.glob("[0-9]_*.py")):
    exec(compile(part.read_text(encoding="utf-8"), str(part), "exec"), namespace)
