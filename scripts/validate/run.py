"""Run the validation parts in numeric order in one shared namespace, so later
parts reuse the paths and skill text earlier parts read. Usage: run.py <repo root>."""
import pathlib
import sys

if sys.version_info < (3, 10):
    raise SystemExit("Python 3.10 or newer is required for validation")

parts = sorted(pathlib.Path(__file__).parent.glob("[0-9]*_*.py"), key=lambda part: int(part.name.split("_", 1)[0]))
if not parts:
    raise SystemExit("no validation parts found")
namespace = {"__name__": "__main__"}
for part in parts:
    exec(compile(part.read_text(encoding="utf-8"), str(part), "exec"), namespace)
