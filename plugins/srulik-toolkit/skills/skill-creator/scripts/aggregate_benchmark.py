#!/usr/bin/env python3
# Adapted from Anthropic skill-creator ca45fc496a3436251f191354091d557da31c15b5, Apache-2.0.
# Modified for validated paired runs, equal fixture weights, and measured-only telemetry.
"""Aggregate canonical evaluation runs into truthful JSON and Markdown summaries."""
import argparse
from datetime import datetime, timezone
import json
import math
from pathlib import Path
import re
from statistics import mean, stdev
import sys

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts.utils import read_json, safe_path, workspace_root


def number(value, *, integer=False):
    if value is None:
        return None
    if type(value) not in (int, float) or not math.isfinite(value) or value < 0:
        raise ValueError("metrics must be finite nonnegative numbers")
    if integer and type(value) is not int:
        raise ValueError("token counts must be integers")
    return value


def load_grade(root, directory):
    grade = read_json(root, directory / "grading.json")
    expectations = grade.get("expectations")
    if not isinstance(expectations, list) or not expectations:
        raise ValueError("grading requires at least one expectation")
    for item in expectations:
        if (not isinstance(item, dict) or type(item.get("passed")) is not bool
                or any(not isinstance(item.get(k), str) or not item[k].strip()
                       for k in ("text", "evidence"))):
            raise ValueError("expectations require text, boolean passed, and evidence")
    passed, total = sum(item["passed"] for item in expectations), len(expectations)
    summary = grade.get("summary", {})
    expected = {"passed": passed, "failed": total-passed, "total": total}
    if any(type(summary.get(k)) is not int or summary[k] != v for k, v in expected.items()):
        raise ValueError("grading summary counts disagree with expectations")
    if not math.isclose(number(summary.get("pass_rate")), passed/total, abs_tol=1e-9):
        raise ValueError("grading pass rate disagrees with expectations")
    timing_file = directory / "timing.json"
    timing = read_json(root, timing_file) if timing_file.exists() or timing_file.is_symlink() else {}
    fallback_time = grade.get("timing", {}).get("total_duration_seconds")
    fallback_tokens = grade.get("execution_metrics", {}).get("total_tokens")
    seconds = timing.get("total_duration_seconds")
    tokens = timing.get("total_tokens")
    return {**expected, "pass_rate": passed/total,
            "time_seconds": number(seconds if seconds is not None else fallback_time),
            "tokens": number(tokens if tokens is not None else fallback_tokens, integer=True)}, expectations


def load_runs(root):
    runs, metadata, seen = [], [], set()
    eval_dirs = sorted(root.glob("eval-*"))
    if not eval_dirs:
        raise ValueError("no eval directories found")
    baseline = None
    for raw_eval in eval_dirs:
        eval_dir = safe_path(root, raw_eval)
        meta = read_json(root, eval_dir / "eval_metadata.json")
        eval_id = meta.get("eval_id")
        if type(eval_id) is not int or eval_id in seen:
            raise ValueError("eval IDs must be unique integers")
        seen.add(eval_id)
        metadata.append(meta)
        configs = {p.name for p in eval_dir.iterdir() if p.is_dir() or p.is_symlink()}
        selected = configs - {"with_skill"}
        if len(selected) != 1 or not selected <= {"without_skill", "old_skill"} or "with_skill" not in configs:
            raise ValueError("each eval requires with_skill and exactly one supported baseline")
        current_baseline = next(iter(selected))
        if baseline is not None and baseline != current_baseline:
            raise ValueError("an iteration cannot mix baseline configurations")
        baseline = current_baseline
        for config in ("with_skill", baseline):
            config_dir = safe_path(root, eval_dir / config)
            run_dirs = sorted(config_dir.iterdir())
            if not run_dirs:
                raise ValueError("missing required run pair")
            for raw_run in run_dirs:
                if not re.fullmatch(r"run-[1-9][0-9]*", raw_run.name):
                    raise ValueError("run directories must use positive run-N names")
                directory = safe_path(root, raw_run)
                if not safe_path(root, directory / "outputs").is_dir():
                    raise ValueError("run outputs directory is missing")
                result, expectations = load_grade(root, directory)
                runs.append({"eval_id": eval_id, "eval_name": meta.get("eval_name", eval_dir.name),
                             "configuration": config, "run_number": int(directory.name[4:]),
                             "result": result, "expectations": expectations})
    return runs, metadata, baseline


def metric_stats(runs, metric):
    by_fixture = {}
    samples = 0
    for run in runs:
        value = run["result"][metric]
        if value is not None:
            by_fixture.setdefault(run["eval_id"], []).append(value)
            samples += 1
    if not by_fixture:
        return None
    values = [mean(items) for items in by_fixture.values()]
    return {"mean": mean(values), "stddev": stdev(values) if len(values) > 1 else 0,
            "min": min(values), "max": max(values), "samples": samples,
            "fixture_ids": sorted(by_fixture), "aggregation": "equal_fixture_means"}


def generate_benchmark(root, skill_name="", skill_path=""):
    root = workspace_root(root)
    runs, identities, baseline = load_runs(root)
    configs, metrics = ("with_skill", baseline), ("pass_rate", "time_seconds", "tokens")
    summary, counts = {}, {}
    for config in configs:
        selected = [r for r in runs if r["configuration"] == config]
        summary[config] = {metric: metric_stats(selected, metric) for metric in metrics}
        for run in selected:
            item = counts.setdefault(str(run["eval_id"]), {})
            item[config] = item.get(config, 0) + 1
    summary["delta"] = {}
    for metric in metrics:
        primary, old = summary["with_skill"][metric], summary[baseline][metric]
        comparable = primary and old and primary["fixture_ids"] == old["fixture_ids"]
        summary["delta"][metric] = round(primary["mean"]-old["mean"], 10) if comparable else None
    meta = {"skill_name": skill_name, "timestamp": datetime.now(timezone.utc).isoformat(),
            "evals_run": sorted(r["eval_id"] for r in identities), "run_counts": counts}
    if skill_path:
        meta["skill_path"] = skill_path
    repetitions = {n for item in counts.values() for n in item.values()}
    if len(repetitions) == 1:
        meta["runs_per_configuration"] = repetitions.pop()
    for key in ("provider", "model"):
        values = [item.get(key) for item in identities]
        if all(isinstance(v, str) and v for v in values) and len(set(values)) == 1:
            meta[key] = values[0]
        elif len({v for v in values if isinstance(v, str) and v}) > 1:
            raise ValueError("separate different provider/model identities into different iterations")
    return {"metadata": meta, "runs": runs, "run_summary": summary,
            "notes": ["Summaries weight fixture means equally; standard deviation is across fixture means."]}


def generate_markdown(benchmark):
    summary = benchmark["run_summary"]
    configs = [c for c in summary if c != "delta"]
    lines = [f"# Skill benchmark: {benchmark['metadata']['skill_name']}", "",
             "Each fixture has equal weight. Variation is across fixture means.", "",
             f"| Metric | {configs[0]} | {configs[1]} | Delta |",
             "| --- | --- | --- | --- |"]
    for metric in ("pass_rate", "time_seconds", "tokens"):
        cells = []
        for config in configs:
            stat = summary[config][metric]
            cells.append("Unavailable" if stat is None else
                         f"{stat['mean']:.4g} ± {stat['stddev']:.4g} ({stat['samples']} samples)")
        delta = summary["delta"][metric]
        lines.append(f"| {metric} | {' | '.join(cells)} | {'Unavailable' if delta is None else f'{delta:+.4g}'} |")
    lines.extend(["", "Actual repetitions by fixture/configuration:", "", "```json",
                  json.dumps(benchmark["metadata"]["run_counts"], indent=2), "```", ""])
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("benchmark_dir", type=Path)
    parser.add_argument("--skill-name", default="")
    parser.add_argument("--skill-path", default="")
    parser.add_argument("--output", "-o", type=Path)
    args = parser.parse_args()
    try:
        root = workspace_root(args.benchmark_dir)
        benchmark = generate_benchmark(root, args.skill_name, args.skill_path)
        output = safe_path(root, args.output or root/"benchmark.json", exists=False)
        markdown = safe_path(root, output.with_suffix(".md"), exists=False)
        output.write_text(json.dumps(benchmark, indent=2, allow_nan=False)+"\n", encoding="utf-8")
        markdown.write_text(generate_markdown(benchmark), encoding="utf-8")
        print(f"Generated {output} and {markdown}")
    except (OSError, ValueError, TypeError, KeyError, AttributeError, RecursionError) as error:
        parser.exit(1, f"Invalid evaluation input: {error}\n")


if __name__ == "__main__":
    main()
