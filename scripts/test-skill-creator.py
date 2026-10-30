#!/usr/bin/env python3
"""Exercise bundled helper commands, files, and process cleanup boundaries."""
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time

SKILL = Path(__file__).resolve().parents[1] / "plugins/srulik-toolkit/skills/skill-creator"

subprocess.run([sys.executable, "-B", str(Path(__file__).with_name("test-skill-creator-optimizer.py"))],
               check=True, timeout=30)

runner = Path(__file__).with_name("validate") / "run.py"
unsupported = subprocess.run([sys.executable, "-B", "-c",
    "import sys,runpy,pathlib; sys.version_info=(3,9,0); "
    "pathlib.Path.glob=lambda *_: iter(()); "
    f"runpy.run_path({str(runner)!r},run_name='__main__')"],
    capture_output=True, text=True, timeout=10)
assert unsupported.returncode != 0 and "Python 3.10" in unsupported.stderr
subprocess.run(["node", str(Path(__file__).with_name("test-skill-creator-feedback.js"))],
               check=True, timeout=10)


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value), encoding="utf-8")


def run_helper(script, *args, success=True):
    result = subprocess.run([sys.executable, str(SKILL / script), *map(str, args)],
                            cwd=SKILL, capture_output=True, text=True, timeout=20)
    assert (result.returncode == 0) == success, result.stdout + result.stderr
    return result


def fixture(root, eval_id=1, config="with_skill", values=(True, False), repeat=1, timing=None):
    directory = root / f"eval-{eval_id}-fixture"
    write_json(directory / "eval_metadata.json", {
        "eval_id": eval_id, "eval_name": f"fixture-{eval_id}", "prompt": "Synthetic fixture",
        "provider": "test", "model": "fake-model", "expectations": ["Known result"],
    })
    target = directory / config / f"run-{repeat}"
    (target / "outputs").mkdir(parents=True, exist_ok=True)
    (target / "outputs/result.md").write_text("Synthetic fixture output", encoding="utf-8")
    write_json(target / "grading.json", {
        "expectations": [{"text": f"Known result {i}", "passed": value,
                          "evidence": "outputs/result.md: synthetic fixture"}
                         for i, value in enumerate(values)],
        "summary": {"passed": sum(values), "failed": len(values)-sum(values),
                    "total": len(values), "pass_rate": sum(values)/len(values)},
        "execution_metrics": {"output_chars": 999},
    })
    if timing is not None:
        write_json(target / "timing.json", timing)
    return target


with tempfile.TemporaryDirectory(prefix="skill-creator-check-") as scratch:
    root = Path(scratch)
    fixture(root)
    fixture(root, config="without_skill", values=(False, False))
    run_helper("scripts/aggregate_benchmark.py", root, "--skill-name", "fixture")
    benchmark = json.loads((root / "benchmark.json").read_text())
    assert benchmark["run_summary"]["with_skill"]["tokens"] is None, "missing tokens became character counts"

    rounded = root / "rounded"
    for eval_id, values, rate in [(1, (True, True, False), 0.67),
                                  (2, (True,) + (False,) * 7, 0.13)]:
        for config in ("with_skill", "without_skill"):
            grade_file = fixture(rounded, eval_id, config, values) / "grading.json"
            grade = json.loads(grade_file.read_text())
            grade["summary"]["pass_rate"] = rate
            write_json(grade_file, grade)
    run_helper("scripts/aggregate_benchmark.py", rounded)
    rounded_results = json.loads((rounded / "benchmark.json").read_text())["runs"]
    assert all(row["result"]["pass_rate"] == {1: 2/3, 2: 1/8}[row["eval_id"]]
               for row in rounded_results), "rounded grade rates changed measured benchmark rates"
    grade["summary"]["pass_rate"] = 0.5
    write_json(grade_file, grade)
    run_helper("scripts/aggregate_benchmark.py", rounded, success=False)

    out_of_range = root / "out-of-range"
    for config in ("with_skill", "without_skill"):
        grade_file = fixture(out_of_range, config=config, values=(True,)) / "grading.json"
    grade = json.loads(grade_file.read_text())
    grade["summary"]["pass_rate"] = 1.004
    write_json(grade_file, grade)
    run_helper("scripts/aggregate_benchmark.py", out_of_range, success=False)

    asymmetric = root / "asymmetric"
    for config, counts in [("with_skill", (3, 1)), ("without_skill", (1, 3))]:
        for eval_id, count in enumerate(counts, 1):
            for repeat in range(1, count+1):
                fixture(asymmetric, eval_id, config, (eval_id == 1,), repeat)
    run_helper("scripts/aggregate_benchmark.py", asymmetric, "--skill-name", "fixture")
    summary = json.loads((asymmetric / "benchmark.json").read_text())["run_summary"]
    assert summary["with_skill"]["pass_rate"]["mean"] == 0.5, "repetition imbalance changed fixture weights"
    assert summary["without_skill"]["pass_rate"]["mean"] == 0.5
    assert float(summary["delta"]["pass_rate"]) == 0

    improvement = root / "improvement"
    fixture(improvement, values=(True,))
    fixture(improvement, config="old_skill", values=(False,))
    run_helper("scripts/aggregate_benchmark.py", improvement, "--skill-name", "fixture")
    improved = json.loads((improvement / "benchmark.json").read_text())
    assert list(improved["run_summary"])[:2] == ["with_skill", "old_skill"], "baseline sorted before primary"
    assert improved["metadata"]["runs_per_configuration"] == 1
    assert improved["metadata"]["model"] == "fake-model"

    viewer = root / "review.html"
    output_dir = improvement / "eval-1-fixture/with_skill/run-1/outputs"
    deliverables = {"metrics.json", "report/metrics.json", "transcript.md", "user_notes.md"}
    for name in deliverables:
        target = output_dir / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text("Synthetic task deliverable", encoding="utf-8")
    run_helper("eval-viewer/generate_review.py", improvement, "--static", viewer)
    embedded = json.loads(viewer.read_text().split("const EMBEDDED_DATA = ", 1)[1].split(";\n", 1)[0])
    outputs = next(run["outputs"] for run in embedded["runs"] if "/with_skill/" in run["id"])
    assert deliverables <= {file["name"] for file in outputs}, "task deliverables were hidden from review"
    assert '"prompt": "Synthetic fixture"' in viewer.read_text(), "canonical metadata was not shown"
    assert 'fetch(' not in viewer.read_text(), "static review attempts network feedback"
    assert 'cdn.sheetjs.com' not in viewer.read_text(), "static review loads remote code"

    run_helper("eval-viewer/generate_review.py", improvement, success=False)
    payload = '</script><script id="fixture-injection">throw Error("injected")</script>&'
    metadata_file = improvement / "eval-1-fixture/eval_metadata.json"
    metadata = json.loads(metadata_file.read_text())
    metadata["prompt"] = payload
    write_json(metadata_file, metadata)
    (improvement / "eval-1-fixture/with_skill/run-1/outputs/unsafe.svg").write_text(payload)
    run_helper("eval-viewer/generate_review.py", improvement, "--static", viewer)
    document = viewer.read_text()
    assert payload not in document and "\\u003c/script>" in document

    class Scripts(HTMLParser):
        def __init__(self):
            super().__init__()
            self.blocks, self.active = [], False
        def handle_starttag(self, tag, attrs):
            if tag == "script":
                assert not dict(attrs).get("src"), "external script in offline review"
                self.blocks.append("")
                self.active = True
        def handle_data(self, data):
            if self.active:
                self.blocks[-1] += data
        def handle_endtag(self, tag):
            if tag == "script":
                self.active = False

    parsed = Scripts()
    parsed.feed(document)
    assert len(parsed.blocks) == 1, "generated content created an executable script"
    syntax = subprocess.run(["node", "--check"], input=parsed.blocks[0], capture_output=True, text=True)
    assert syntax.returncode == 0, syntax.stderr

    # Exercise the actual benchmark renderer, including text used in attributes.
    hostile = json.loads(json.dumps(improved))
    evidence = '\" onmouseover=\"fixture()\" data-probe=\"'
    hostile["runs"][0]["expectations"][0]["evidence"] = evidence
    hostile["metadata"]["runs_per_configuration"] = '<img src=x onerror="fixture()">'
    source = parsed.blocks[0]
    utility = source[source.index("    function escapeHtml("):source.index("    // ---- View switching ----")]
    renderer = source[source.index("    function renderBenchmark("):source.index("    // ---- Start ----")]
    rendered = subprocess.run(["node"], input='''
const nodes = {};
const document = {
  getElementById(id) { return nodes[id] ||= {style: {}, innerHTML: ""}; },
  createElement() { return {textContent: "", get innerHTML() {
    return String(this.textContent).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }}; }
};
const EMBEDDED_DATA = ''' + json.dumps({"benchmark": hostile}) + ";\n" + utility + renderer + '''
renderBenchmark();
process.stdout.write(nodes["benchmark-content"].innerHTML);
''', capture_output=True, text=True, timeout=10)
    assert rendered.returncode == 0, rendered.stderr

    class InertBenchmark(HTMLParser):
        def handle_starttag(self, tag, attrs):
            assert tag != "img", "benchmark metadata became active markup"
            assert not any(k.startswith("on") for k, _ in attrs), "grading evidence injected an event handler"

    InertBenchmark().feed(rendered.stdout)
    assert evidence in rendered.stdout.replace("&quot;", '\"'), "evidence text was lost"

    for key, value in [("runs_per_configuration", 99), ("evals_run", [99]),
                       ("run_counts", {"1": {"with_skill": 99, "old_skill": 99}})]:
        tampered = {**improved, "metadata": {**improved["metadata"], key: value}}
        tampered_file = improvement / "tampered-benchmark.json"
        write_json(tampered_file, tampered)
        run_helper("eval-viewer/generate_review.py", improvement, "--benchmark", tampered_file,
                   "--static", viewer, success=False)

    reviews = [{"run_id": f"eval-1-fixture/{config}/run-1", "feedback": "Synthetic round-trip only"}
               for config in ("with_skill", "old_skill")]
    feedback = root / "downloaded-feedback.json"
    write_json(feedback, {"status": "complete", "reviews": reviews})
    run_helper("eval-viewer/generate_review.py", improvement, "--feedback", feedback)
    assert json.loads((improvement / "feedback.json").read_text())["reviews"] == reviews
    write_json(feedback, {"status": "complete", "reviews": reviews + [reviews[0]]})
    run_helper("eval-viewer/generate_review.py", improvement, "--feedback", feedback, success=False)
    write_json(feedback, {"status": "in_progress", "reviews": reviews})
    run_helper("eval-viewer/generate_review.py", improvement, "--feedback", feedback, success=False)

    measured = root / "measured"
    fixture(measured, timing={"total_tokens": 0, "total_duration_seconds": 0})
    fixture(measured, config="without_skill")
    fixture(measured, eval_id=2)
    fixture(measured, eval_id=2, config="without_skill", timing={"total_tokens": 12, "total_duration_seconds": 2})
    run_helper("scripts/aggregate_benchmark.py", measured)
    measurements = json.loads((measured / "benchmark.json").read_text())["run_summary"]
    assert measurements["with_skill"]["tokens"]["mean"] == 0
    assert measurements["with_skill"]["tokens"]["samples"] == 1
    assert measurements["delta"]["tokens"] is None
    assert measurements["delta"]["time_seconds"] is None

    invalid = root / "invalid"
    current = fixture(invalid)
    fixture(invalid, config="without_skill")
    grade_file = current / "grading.json"
    original = json.loads(grade_file.read_text())
    for changed in [{**original, "expectations": []},
                    {**original, "summary": {**original["summary"], "total": 99}},
                    {**original, "timing": {"total_duration_seconds": float("nan")}}]:
        write_json(grade_file, changed)
        run_helper("scripts/aggregate_benchmark.py", invalid, success=False)
    grade_file.write_text("{bad JSON")
    run_helper("scripts/aggregate_benchmark.py", invalid, success=False)
    grade_file.unlink()
    run_helper("scripts/aggregate_benchmark.py", invalid, success=False)
    write_json(grade_file, original)

    outside = root / "private.txt"
    outside.write_text("outside the selected workspace")
    linked = current / "outputs/linked.txt"
    try:
        linked.symlink_to(outside)
    except (OSError, NotImplementedError):
        print("SKIP symlink cases: this platform lacks symlink permission.")
    else:
        run_helper("eval-viewer/generate_review.py", invalid, "--static", viewer, success=False)
        linked.unlink()
        for source in [grade_file, invalid / "eval-1-fixture/eval_metadata.json"]:
            contents = source.read_bytes()
            source.unlink()
            source.symlink_to(outside)
            run_helper("scripts/aggregate_benchmark.py", invalid, success=False)
            source.unlink()
            source.write_bytes(contents)
        linked.symlink_to(current / "outputs", target_is_directory=True)
        run_helper("eval-viewer/generate_review.py", invalid, "--static", viewer, success=False)
        linked.unlink()

    if os.name == "posix":
        project = root / "optimizer"
        (project / ".claude").mkdir(parents=True)
        binary = root / "fake-bin"
        binary.mkdir()
        fake = binary / "claude"
        fake.write_text('''#!/usr/bin/env python3
import json, os, sys, time
from pathlib import Path
Path("fake-pid").write_text(str(os.getpid()))
mode = os.environ.get("FIXTURE_CLAUDE_MODE", "success")
if mode == "failure":
    sys.exit(7)
if mode == "timeout":
    time.sleep(10)
if mode == "proposal-timeout":
    import subprocess
    child = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(10)"],
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    Path("fake-child-pid").write_text(str(child.pid))
    time.sleep(10)
if mode == "exited-parent":
    import subprocess
    child = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(10)"])
    Path("fake-child-pid").write_text(str(child.pid))
    sys.exit(0)
name = next(Path(".claude/commands").glob("*.md")).stem
print(json.dumps({"type":"assistant","message":{"content":[{"type":"tool_use","name":"Skill","input":{"skill":name}}]}}), flush=True)
''')
        fake.chmod(0o700)
        target = project / "target"
        target.mkdir()
        skill_file = target / "SKILL.md"
        skill_file.write_text("---\nname: fixture\ndescription: Synthetic fixture\n---\nDo the fixture.")
        eval_set = project / "evals.json"
        write_json(eval_set, [{"query": "Synthetic task", "should_trigger": True}])
        environment = {**os.environ, "PATH": str(binary)+os.pathsep+os.environ["PATH"], "PYTHONPATH": str(SKILL)}

        def optimizer(mode, success):
            result = subprocess.run([sys.executable, "-m", "scripts.run_eval", "--eval-set", str(eval_set),
                                     "--skill-path", str(target), "--num-workers", "1", "--runs-per-query", "1", "--timeout", "1"],
                                    cwd=project, env={**environment, "FIXTURE_CLAUDE_MODE": mode},
                                    capture_output=True, text=True, timeout=15)
            assert (result.returncode == 0) == success, result.stdout + result.stderr
            assert not list((project / ".claude").rglob("*-skill-*.md")), "temporary command leaked"
            return result

        assert json.loads(optimizer("success", True).stdout)["results"][0]["triggers"] == 1
        write_json(eval_set, [{"query": "Synthetic non-trigger", "should_trigger": False}])
        optimizer("failure", False)
        optimizer("timeout", False)
        pid = int((project / "fake-pid").read_text())
        try:
            os.kill(pid, 0)
        except ProcessLookupError:
            pass
        else:
            raise AssertionError("timed-out owned child still runs")
        (project / "fake-pid").unlink()
        # Force the supported race: direct child exited, descendant holds stdout.
        try:
            started = time.monotonic()
            bounded = subprocess.run(
                [sys.executable, "-B", "-c", '''
import time
from pathlib import Path
from scripts import run_eval
original = run_eval.subprocess.Popen
def exited_parent(*args, **kwargs):
    process = original(*args, **kwargs)
    time.sleep(0.2)
    return process
run_eval.subprocess.Popen = exited_parent
run_eval.run_single_query('Synthetic task', 'fixture', 'Synthetic fixture', 1, str(Path.cwd()))
'''], cwd=project, env={**environment, "FIXTURE_CLAUDE_MODE": "exited-parent"},
                capture_output=True, text=True, timeout=3)
            assert bounded.returncode != 0 and "timed out" in bounded.stderr
            assert time.monotonic() - started < 2.5, "descendant pipe bypassed trigger timeout"
        finally:
            if (project / "fake-pid").exists():
                try:
                    os.killpg(int((project / "fake-pid").read_text()), signal.SIGKILL)
                except ProcessLookupError:
                    pass
                (project / "fake-pid").unlink()
        proposal = subprocess.run(
            [sys.executable, "-B", "-c", "from scripts.improve_description import _call_claude; "
             "_call_claude('Synthetic proposal', 'fake-model', timeout=1)"],
            cwd=project, env={**environment, "FIXTURE_CLAUDE_MODE": "proposal-timeout"},
            capture_output=True, text=True, timeout=15)
        assert proposal.returncode != 0 and "TimeoutExpired" in proposal.stderr
        child_pid = int((project / "fake-child-pid").read_text())
        try:
            deadline = time.monotonic() + 2
            while True:
                try:
                    os.kill(child_pid, 0)
                except ProcessLookupError:
                    break
                state = Path(f"/proc/{child_pid}/stat")
                if state.exists() and state.read_text().split()[2] == "Z":
                    break  # A terminated orphan can await the OS reaper.
                assert time.monotonic() < deadline, "proposal timeout left an owned descendant running"
                time.sleep(0.02)
        finally:
            try:
                os.kill(child_pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
        (project / "fake-pid").unlink()
        skill_file.write_text("---\nname: ../escaped\ndescription: Synthetic fixture\n---\nDo it.")
        optimizer("success", False)
        assert not (project / "fake-pid").exists(), "invalid target name reached the process boundary"

print("Skill creator helper checks passed.")
