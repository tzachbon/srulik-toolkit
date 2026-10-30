"""Local-only regressions for optional trigger evaluation and optimization."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
from unittest.mock import patch

SKILL = Path(__file__).resolve().parents[1] / "plugins/srulik-toolkit/skills/skill-creator"
sys.path.insert(0, str(SKILL))
from scripts import run_eval, run_loop


def check_triggers():
    if os.name != "posix":
        print("SKIP trigger subprocess cases: optional optimizer is POSIX-only.")
        return
    with tempfile.TemporaryDirectory(prefix="creator-trigger-") as scratch:
        root = Path(scratch).resolve()
        (root / ".claude").mkdir()
        binary = root / "bin"
        binary.mkdir()
        fake = binary / "claude"
        fake.write_text('''#!/usr/bin/env python3
import json, os, sys, time
from pathlib import Path
Path("pid").write_text(str(os.getpid()))
name = next(Path(".claude/commands").glob("*.md")).stem
mode = sys.argv[sys.argv.index("-p") + 1]
def emit(value):
    print(json.dumps(value), flush=True)
def tool(name, value):
    return {"type":"tool_use", "name":name, "input":value}
def assistant(items):
    emit({"type":"assistant", "message":{"content":items}})
def stream(kind, **fields):
    emit({"type":"stream_event", "event":{"type":kind, **fields}})
def block(tool_name, value):
    stream("content_block_start", content_block={"type":"tool_use", "name":tool_name})
    stream("content_block_delta", delta={"type":"input_json_delta", "partial_json":json.dumps(value)})
    stream("content_block_stop")
read = tool("Read", {"file_path":"README.md"})
target = tool("Skill", {"skill":name})
if mode == "assistant-same-message":
    assistant([read, target])
elif mode == "assistant-later":
    assistant([read])
    assistant([tool("Bash", {"command":"pwd"})])
    assistant([target])
elif mode.startswith("stream-"):
    block("Bash", {"command":"pwd"})
    block("Read", {"file_path":"README.md"})
    stream("message_stop")
    if mode == "stream-skill":
        block("Skill", {"skill":name})
    elif mode == "stream-read":
        block("Read", {"file_path":str(Path(".claude/commands") / (name + ".md"))})
    else:
        block("Bash", {"command":"echo " + name})
else:
    assistant([read])
if mode == "eof":
    sys.exit(0)
if mode != "timeout":
    emit({"type":"result", "subtype":"error_fixture" if mode == "error" else "success"})
time.sleep(10)
''', encoding="utf-8")
        fake.chmod(0o700)
        failures = []
        with patch.dict(os.environ, {"PATH": str(binary) + os.pathsep + os.environ["PATH"]}):
            for mode in ("assistant-same-message", "assistant-later", "stream-skill", "stream-read",
                         "stream-unrelated", "unrelated", "error", "eof", "timeout"):
                started = time.monotonic()
                try:
                    if mode in ("error", "eof", "timeout"):
                        try:
                            run_eval.run_single_query(mode, "fixture", "Synthetic fixture", 1, str(root))
                        except (RuntimeError, TimeoutError):
                            pass
                        else:
                            raise AssertionError("unknown outcome was scored as a non-trigger")
                    else:
                        actual = run_eval.run_single_query(mode, "fixture", "Synthetic fixture", 1, str(root))
                        expected = mode in ("assistant-same-message", "assistant-later", "stream-skill", "stream-read")
                        assert actual == expected, f"expected {expected}, got {actual}"
                    assert time.monotonic() - started < 3, "observation or cleanup exceeded its bound"
                except AssertionError as error:
                    failures.append(f"{mode}: {error}")
                assert not list((root / ".claude").rglob("*-skill-*.md")), "temporary command leaked"
                try:
                    os.kill(int((root / "pid").read_text()), 0)
                except ProcessLookupError:
                    pass
                else:
                    raise AssertionError("owned fake process survived cleanup")
        assert not failures, "; ".join(failures)


def check_holdout():
    with tempfile.TemporaryDirectory(prefix="creator-holdout-") as scratch:
        root = Path(scratch)
        (root / "SKILL.md").write_text("---\nname: fixture\ndescription: Synthetic fixture\n---\nDo it.\n")
        tiny = [{"query": "positive", "should_trigger": True},
                {"query": "negative", "should_trigger": False}]

        def failed_eval(**kwargs):
            rows = [{**q, "pass": False, "triggers": int(not q["should_trigger"]), "runs": 1}
                    for q in kwargs["eval_set"]]
            return {"results": rows, "summary": {"total": len(rows), "passed": 0, "failed": len(rows)}}

        def optimize(queries, holdout):
            return run_loop.run_loop(queries, root, None, 1, 1, 2, 1, 0.5,
                                     holdout, "fake-model", False)

        with patch.object(run_loop, "find_project_root", return_value=root), \
                patch.object(run_loop, "run_eval", side_effect=failed_eval) as evaluate, \
                patch.object(run_loop, "improve_description", return_value="Revised fixture") as improve:
            for queries in (tiny, tiny[:1], tiny + [{"query": "another-positive", "should_trigger": True}]):
                try:
                    output = optimize(queries, 0.4)
                except ValueError as error:
                    assert "holdout" in str(error) and "--holdout 0" in str(error)
                else:
                    raise AssertionError(f"undersized holdout accepted: {output['exit_reason']}, "
                                         f"train={output['best_train_score']}, test={output['best_score']}")
            assert not evaluate.called and not improve.called, "invalid split reached model calls"
            for fraction in (-0.1, 1, float("nan"), float("inf")):
                try:
                    optimize(tiny, fraction)
                except ValueError:
                    pass
                else:
                    raise AssertionError(f"invalid holdout accepted: {fraction}")
            output = optimize(tiny, 0)
            assert output["train_size"] == 2 and output["test_size"] == 0
            assert not output["exit_reason"].startswith("all_passed") and improve.call_count == 1
            for size in (4, 8):
                larger = [{"query": f"query-{n}", "should_trigger": n % 2 == 0} for n in range(size)]
                train, test = run_loop.split_eval_set(larger, 0.4)
                assert train and test and len(train) + len(test) == size
                assert {q["should_trigger"] for q in train} == {True, False}
                assert {q["should_trigger"] for q in test} == {True, False}
                assert {q["query"] for q in train}.isdisjoint(q["query"] for q in test)
                output = optimize(larger, 0.4)
                assert output["history"][0]["train_total"] > 0
                assert not output["exit_reason"].startswith("all_passed")


failures = []
for check in (check_triggers, check_holdout):
    try:
        check()
        print(f"PASS {check.__name__}")
    except AssertionError as error:
        failures.append(f"{check.__name__}: {error}")
        print(f"FAIL {failures[-1]}")
assert not failures, "Optional optimizer regressions failed"
