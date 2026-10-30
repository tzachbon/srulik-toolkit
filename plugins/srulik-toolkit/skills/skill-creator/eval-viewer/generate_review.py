#!/usr/bin/env python3
# Adapted from Anthropic skill-creator ca45fc496a3436251f191354091d557da31c15b5, Apache-2.0.
# Modified for confined, offline static review and explicit completed-feedback import.
"""Generate an offline evaluation review or validate and import completed feedback."""
import argparse
import base64
import json
import mimetypes
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts.aggregate_benchmark import generate_benchmark
from scripts.utils import read_json, safe_path, workspace_root

TEXT_EXTENSIONS = {".txt", ".md", ".json", ".csv", ".py", ".js", ".ts", ".tsx",
                   ".jsx", ".yaml", ".yml", ".xml", ".html", ".svg", ".css", ".sh",
                   ".rb", ".go", ".rs", ".java", ".c", ".cpp", ".h", ".sql", ".toml"}
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp"}


def embed_file(root, path, outputs):
    path = safe_path(root, path)
    name = path.relative_to(outputs).as_posix()
    if path.suffix.lower() in TEXT_EXTENSIONS:
        return {"name": name, "type": "text", "content": path.read_text(encoding="utf-8", errors="replace")}
    mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    content = base64.b64encode(path.read_bytes()).decode("ascii")
    kind = "image" if path.suffix.lower() in IMAGE_EXTENSIONS else "binary"
    return {"name": name, "type": kind, "mime": mime, "data_uri": f"data:{mime};base64,{content}"}


def find_runs(root, benchmark):
    directories = {}
    for directory in sorted(root.glob("eval-*")):
        meta = read_json(root, directory / "eval_metadata.json")
        if not isinstance(meta.get("prompt"), str) or not meta["prompt"].strip():
            raise ValueError("eval metadata requires the actual prompt")
        directories[meta["eval_id"]] = (directory, meta)
    runs = []
    for row in benchmark["runs"]:
        directory, meta = directories[row["eval_id"]]
        run_dir = safe_path(root, directory / row["configuration"] / f"run-{row['run_number']}")
        outputs = safe_path(root, run_dir / "outputs")
        files = []
        for candidate in sorted(outputs.rglob("*")):
            checked = safe_path(root, candidate)
            if checked.is_file():
                files.append(embed_file(root, candidate, outputs))
        runs.append({"id": run_dir.relative_to(root).as_posix(), "prompt": meta["prompt"],
                     "eval_id": row["eval_id"], "outputs": files,
                     "grading": read_json(root, run_dir / "grading.json")})
    return runs


def validate_feedback(data, runs):
    if not isinstance(data, dict) or data.get("status") != "complete" or not isinstance(data.get("reviews"), list):
        raise ValueError("feedback must be explicitly complete")
    expected, seen = {run["id"] for run in runs}, set()
    for review in data["reviews"]:
        if not isinstance(review, dict) or not isinstance(review.get("feedback"), str):
            raise ValueError("feedback entries require string feedback")
        run_id = review.get("run_id")
        if not isinstance(run_id, str) or run_id not in expected or run_id in seen:
            raise ValueError("feedback has unknown or duplicate run IDs")
        seen.add(run_id)
    if seen != expected:
        raise ValueError("completed feedback must include every displayed run")
    return data


def previous_data(path):
    root = workspace_root(path)
    runs = find_runs(root, generate_benchmark(root))
    feedback_file = root / "feedback.json"
    feedback = validate_feedback(read_json(root, feedback_file), runs) if feedback_file.exists() or feedback_file.is_symlink() else {"reviews": []}
    return {run["id"]: {"outputs": run["outputs"], "feedback": next(
        (r["feedback"] for r in feedback["reviews"] if r["run_id"] == run["id"]), "")} for run in runs}


def generate_html(runs, skill_name, previous=None, benchmark=None, feedback=None):
    previous = previous or {}
    embedded = {"skill_name": skill_name, "runs": runs,
                "previous_feedback": {key: value["feedback"] for key, value in previous.items()},
                "previous_outputs": {key: value["outputs"] for key, value in previous.items()},
                "feedback": feedback or {"reviews": []}}
    if benchmark is not None:
        embedded["benchmark"] = benchmark
    encoded = json.dumps(embedded, ensure_ascii=True, allow_nan=False).replace("<", "\\u003c")
    template = Path(__file__).with_name("viewer.html").read_text(encoding="utf-8")
    return template.replace("/*__EMBEDDED_DATA__*/", f"const EMBEDDED_DATA = {encoded};")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("workspace", type=Path)
    parser.add_argument("--skill-name")
    parser.add_argument("--previous-workspace", type=Path)
    parser.add_argument("--benchmark", type=Path)
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument("--static", type=Path, help="Write an offline review file; no server is started")
    action.add_argument("--feedback", type=Path, help="Validate and import explicitly completed feedback")
    args = parser.parse_args()
    try:
        root = workspace_root(args.workspace)
        computed = generate_benchmark(root, args.skill_name or root.name)
        runs = find_runs(root, computed)
        if args.feedback:
            selected_root = workspace_root(args.feedback.absolute().parent)
            data = validate_feedback(read_json(selected_root, args.feedback), runs)
            destination = safe_path(root, root/"feedback.json", exists=False)
            destination.write_text(json.dumps(data, indent=2, allow_nan=False)+"\n", encoding="utf-8")
            print("Completed feedback validated and imported; provenance still requires a human receipt.")
            return
        benchmark = None
        if args.benchmark:
            benchmark = read_json(root, args.benchmark)
            if (benchmark.get("runs") != computed["runs"]
                    or benchmark.get("run_summary") != computed["run_summary"]
                    or any(benchmark.get("metadata", {}).get(key) != computed["metadata"].get(key)
                           for key in ("evals_run", "run_counts", "runs_per_configuration"))):
                raise ValueError("benchmark does not match the selected workspace")
        previous = previous_data(args.previous_workspace) if args.previous_workspace else {}
        feedback_file = root / "feedback.json"
        feedback = validate_feedback(read_json(root, feedback_file), runs) if feedback_file.exists() or feedback_file.is_symlink() else None
        output = args.static.absolute()
        if output.exists():
            safe_path(workspace_root(output.parent), output)
        else:
            output.parent.mkdir(parents=True, exist_ok=True)
            safe_path(workspace_root(output.parent), output, exists=False)
        output.write_text(generate_html(runs, args.skill_name or root.name, previous, benchmark, feedback), encoding="utf-8")
        print(f"Static review written to {output}")
    except (OSError, ValueError, TypeError, KeyError, AttributeError, RecursionError) as error:
        parser.exit(1, f"Invalid review input: {error}\n")


if __name__ == "__main__":
    main()
