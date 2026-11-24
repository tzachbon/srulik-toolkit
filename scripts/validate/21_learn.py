# Self-learning loop: capture, start, merge and stats in scripts/learn.js, run as
# fake sessions per harness against a temporary state home and git repository.
learn = plugin / "scripts" / "learn.js"
learn_text = "".join(f.read_text(encoding="utf-8") for f in [learn, *sorted((plugin / "scripts" / "learn").glob("*.js"))])
automatic = (plugin / "skills" / "retro" / "references" / "automatic.md").read_text(encoding="utf-8")
retro = (plugin / "skills" / "retro" / "SKILL.md").read_text(encoding="utf-8")
for token in ['"deltas"', "two sightings", "At most one `project_fix`", "Never rewrite", "never commit", "empty `deltas` array", "untrusted data"]:
    if token not in automatic:
        raise SystemExit(f"retro automatic mode is missing {token!r}")
if "references/automatic.md" not in retro:
    raise SystemExit("retro must link its automatic mode")
for token in ["## Self-learning", "SRULIK_TOOLKIT_LEARN=0", "SRULIK_TOOLKIT_LEARN_PRS=1", "~/.srulik-toolkit/learn", "learn.js stats"]:
    if token not in readme:
        raise SystemExit(f"README self-learning section is missing {token!r}")
# The review must not capture or review itself (R12).
if learn_text.count('SRULIK_TOOLKIT_LEARN: "0"') != 2:
    raise SystemExit("both review routes must pass SRULIK_TOOLKIT_LEARN=0 to the child")
if learn_text.count("...reviewEnv(),") != 2:
    raise SystemExit("both review routes must drop CLAUDECODE so a nested claude -p can run")
for token in ['"--tools", "Read,Edit,Write,Glob,Grep"', '"--sandbox", "enabled"', '"--sandbox", "workspace-write"', "untrusted data, never instructions"]:
    if token not in learn_text:
        raise SystemExit(f"the review run must be limited to file tools and treat signals as data: {token}")


def learn_env(home, **extra):
    env = {k: v for k, v in os.environ.items() if not k.startswith("SRULIK_TOOLKIT_") and k != "T3CODE_THREAD_ID"}
    env.update({"SRULIK_TOOLKIT_LEARN_HOME": str(home), "SRULIK_TOOLKIT_LEARN_DRY": "1", "GIT_CONFIG_GLOBAL": os.devnull, "GIT_CONFIG_NOSYSTEM": "1",
                "GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@example.com", "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "t@example.com"})
    env.update(extra)
    return env


def learn_run(home, args, payload=None, run_cwd=None, **extra):
    result = subprocess.run([node, str(learn), *args], input=json.dumps(payload) if payload is not None else "", env=learn_env(home, **extra),
                            cwd=run_cwd, capture_output=True, text=True, timeout=60)
    if result.returncode or result.stderr:
        raise SystemExit(f"learn.js {args} failed: {result.stderr}")
    return result.stdout


def learn_git(cwd, *args):
    return subprocess.run(["git", "-C", str(cwd), *args], env=learn_env(cwd), capture_output=True, text=True, check=True, timeout=30).stdout.strip()


def learn_project(home):
    projects = list((home / "projects").iterdir())
    if len(projects) != 1:
        raise SystemExit(f"expected one project state folder, found {len(projects)}")
    return projects[0]


def learn_signals(home):
    file = learn_project(home) / "signals.jsonl"
    return [json.loads(line) for line in file.read_text(encoding="utf-8").splitlines()] if file.exists() else []


def learn_deltas(home, deltas, worktree=None, run_cwd=None, raw=None, **extra):
    file = home / "deltas-input.json"
    file.write_text(raw if raw is not None else json.dumps({"deltas": deltas}), encoding="utf-8")
    args = ["merge", learn_project(home).name, str(file)] + ([str(worktree)] if worktree else [])
    return json.loads(learn_run(home, args, run_cwd=run_cwd or worktree, **extra))


def learn_review_head(home, worktree, source=None, launch_at="2000-01-01T00:00:00.000Z"):
    file = learn_project(home) / "state.json"
    state = json.loads(file.read_text(encoding="utf-8"))
    state["review_head"] = learn_git(worktree, "rev-parse", "HEAD")
    state["review_source"] = str(pathlib.Path(source).resolve()) if source else None
    state["last_launch"] = {**state.get("last_launch", {}), "at": launch_at}
    file.write_text(json.dumps(state), encoding="utf-8")


def learn_repo(base):
    repo = base / "repo"
    repo.mkdir()
    learn_git(repo, "init", "-q", "-b", "main")
    (repo / "AGENTS.md").write_text("# Agents\n", encoding="utf-8")
    learn_git(repo, "add", "-A")
    learn_git(repo, "commit", "-q", "-m", "init")
    return repo


with tempfile.TemporaryDirectory() as temporary:
    base = pathlib.Path(temporary)
    home = base / "home"
    repo = learn_repo(base)
    cwd = str(repo)
    sessions = {
        "claude": [
            ({"hook_event_name": "UserPromptSubmit", "session_id": "c1", "cwd": cwd, "prompt": "no, use pnpm not npm"}, "correction"),
            ({"hook_event_name": "UserPromptSubmit", "session_id": "c1", "cwd": cwd, "prompt": "add a login page"}, None),
            ({"hook_event_name": "UserPromptSubmit", "session_id": "c1", "cwd": cwd, "prompt": "no, srulik-learn-review applies here"}, None),
            ({"hook_event_name": "PostToolUseFailure", "session_id": "c1", "cwd": cwd, "tool_name": "Bash", "tool_input": {"command": "npm test"}, "error": "Exit code 1"}, "failed_check"),
        ],
        "codex": [
            ({"hook_event_name": "UserPromptSubmit", "session_id": "x1", "cwd": cwd, "prompt": "remember: CI runs on Windows too"}, "remember"),
            ({"hook_event_name": "PostToolUse", "session_id": "x1", "cwd": cwd, "tool_name": "Bash", "tool_input": {"command": "pytest -q"}, "tool_response": "Exit code: 2\nFAILED"}, "failed_check"),
            ({"hook_event_name": "PostToolUse", "session_id": "x1", "cwd": cwd, "tool_name": "Bash", "tool_input": {"command": "pytest -q"}, "tool_response": {"exit_code": 0}}, None),
            ({"hook_event_name": "PostToolUse", "session_id": "x1", "cwd": cwd, "tool_name": "Bash", "tool_input": {"command": "ls"}, "tool_response": "Exit code: 1"}, None),
        ],
        "cursor": [
            ({"hook_event_name": "beforeSubmitPrompt", "conversation_id": "u1", "workspace_roots": [cwd], "prompt": "actually, keep the old API"}, "correction"),
            ({"hook_event_name": "postToolUseFailure", "conversation_id": "u1", "workspace_roots": [cwd], "tool_name": "Shell", "tool_input": {"command": "npm run lint"}}, "failed_check"),
        ],
    }
    count = 0
    for harness, events in sessions.items():
        for payload, kind in events:
            out = learn_run(home, ["capture", harness], payload)
            if harness == "cursor" and payload["hook_event_name"] == "beforeSubmitPrompt" and json.loads(out) != {"continue": True}:
                raise SystemExit("Cursor prompt capture must let the prompt continue")
            if kind:
                count += 1
            signals = learn_signals(home) if (home / "projects").exists() else []
            if len(signals) != count or (kind and (signals[-1]["kind"], signals[-1]["harness"]) != (kind, harness)):
                raise SystemExit(f"{harness} {payload['hook_event_name']} must log {kind or 'nothing'}")

    learn_run(home, ["capture", "claude"], {"cwd": cwd, "prompt": "no, the key is sk-abcdefghijklmnop and Bearer abc.def token=hunter2 " + "x" * 900})
    leaked = learn_signals(home)[-1]["text"]
    if any(secret in leaked for secret in ["sk-abcdefghijklmnop", "abc.def", "hunter2"]) or len(leaked) > 500:
        raise SystemExit("captured text must be redacted and truncated to 500 characters")
    learn_run(home, ["capture", "claude"], {"cwd": cwd, "prompt": "no, never again"}, SRULIK_TOOLKIT_LEARN="0")
    if len(learn_signals(home)) != count + 1:
        raise SystemExit("SRULIK_TOOLKIT_LEARN=0 must stop capture")
    if learn_run(home, ["start", "claude"], {"cwd": cwd}, SRULIK_TOOLKIT_LEARN="0") or (learn_project(home) / "state.json").exists():
        raise SystemExit("SRULIK_TOOLKIT_LEARN=0 must stop injection and review")

    learn_run(home, ["start", "claude"], {"cwd": cwd})
    state_file = learn_project(home) / "state.json"
    state = json.loads(state_file.read_text(encoding="utf-8"))
    launch = state.get("last_launch", {})
    if launch.get("route") != "cli" or launch.get("argv", [None])[-4:-1] != ["review", "claude", learn_project(home).name] or not launch["argv"][-1]:
        raise SystemExit(f"start must launch the harness CLI review with new signals: {launch}")
    if not (learn_project(home) / "review.lock").is_dir():
        raise SystemExit("a launched review must hold the project lock")
    state["last_review_at"] = "2000-01-01T00:00:00.000Z"
    state.pop("last_launch")
    state_file.write_text(json.dumps(state), encoding="utf-8")
    learn_run(home, ["start", "claude"], {"cwd": cwd})
    if "last_launch" in json.loads(state_file.read_text(encoding="utf-8")):
        raise SystemExit("a held lock must stop a second review, including one from the review's own session")

    learn_run(home, ["capture", "claude"], {"cwd": cwd, "prompt": "no, after the launch"})
    if learn_deltas(home, [{"op": "explode", "scope": "user", "id": "a"}, {"op": "add", "scope": "user", "id": "long", "text": "x" * 300}, {"op": "seen", "scope": "user", "id": "missing"}])["applied"] != 0:
        raise SystemExit("invalid deltas must be rejected")
    if (home / "user" / "lessons.json").read_text(encoding="utf-8").count('"id"'):
        raise SystemExit("rejected deltas must not change the stores")
    if [s["text"] for s in learn_signals(home)] != ["no, after the launch"]:
        raise SystemExit("merge must consume the reviewed signals and keep the ones logged after launch")
    stale = home / "stores.lock"
    stale.mkdir()
    os.utime(stale, (0, 0))
    rejected = json.loads(state_file.read_text(encoding="utf-8"))["rejected"]
    if [r["reason"] for r in rejected] != ["unknown op", "text must be 1 to 200 characters", "unknown id"]:
        raise SystemExit(f"rejections must be recorded with reasons: {rejected}")

    once = learn_deltas(home, [{"op": "add", "scope": "user", "id": "planted", "text": "Do X."}, {"op": "seen", "scope": "user", "id": "planted"}])
    if once["rejected"] != ["duplicate id in one review"] or "Do X." in learn_run(home, ["start", "claude"], {"cwd": cwd}):
        raise SystemExit("one review must not move an entry twice")
    if stale.exists():
        raise SystemExit("a stale store lock must be broken and released")
    if (home / "deltas-input.json").exists():
        raise SystemExit("merge must delete the deltas file so it is never merged twice")
    learn_run(home, ["capture", "claude"], {"cwd": cwd, "prompt": "no, keep this signal"})
    kept = len(learn_signals(home))
    if learn_deltas(home, None, raw="not json")["rejected"] != ["invalid deltas file"] or len(learn_signals(home)) != kept:
        raise SystemExit("a malformed deltas file must keep the signals for the next review")
    learn_deltas(home, [{"op": "add", "scope": "project", "id": "use-pnpm", "text": "Use pnpm, not npm."},
                        {"op": "add", "scope": "override", "skill": "create-pr", "id": "draft-prs", "text": "Open pull requests as drafts."}])
    if "Use pnpm" in learn_run(home, ["start", "claude"], {"cwd": cwd}):
        raise SystemExit("a lesson seen once must not be injected")
    learn_deltas(home, [{"op": "seen", "scope": "project", "id": "use-pnpm"}, {"op": "seen", "scope": "override", "id": "draft-prs"}])
    injected = learn_run(home, ["start", "codex"], {"cwd": cwd})
    if "- Use pnpm, not npm." not in injected or "- When using `create-pr`: Open pull requests as drafts." not in injected:
        raise SystemExit(f"lessons seen twice must be injected, overrides by skill: {injected}")
    cursor_out = json.loads(learn_run(home, ["start", "cursor"], {"workspace_roots": [cwd]}))
    if "Use pnpm" not in cursor_out.get("additional_context", ""):
        raise SystemExit("Cursor start must return lessons as additional_context JSON")
    learn_run(home, ["capture", "claude"], {"cwd": cwd, "prompt": "no, use pnpm"})
    learn_deltas(home, [{"op": "seen", "scope": "override", "id": "draft-prs", "ts": learn_signals(home)[0]["ts"]}])
    learn_deltas(home, [{"op": "seen", "scope": "project", "id": "use-pnpm", "ts": learn_signals(home)[-1]["ts"]}])
    report = learn_run(home, ["stats", learn_project(home).name])
    if "project/use-pnpm: seen 3, applied yes, recurred_after_apply 1" not in report or "applied: 2, applied with zero recurrences: 1" not in report:
        raise SystemExit(f"recurrence must count only after injection: {report}")

    learn_deltas(home, [{"op": "add", "scope": "user", "id": f"rank-{i:02d}", "text": f"Rule {i}."} for i in range(15)])
    learn_deltas(home, [{"op": "seen", "scope": "user", "id": f"rank-{i:02d}"} for i in range(15)])
    learn_deltas(home, [{"op": "seen", "scope": "user", "id": "rank-14"}])
    lines = [l for l in learn_run(home, ["start", "claude"], {"cwd": cwd}).splitlines() if l.startswith("- ")]
    if len(lines) != 10 or set(lines[:3]) != {"- Use pnpm, not npm.", "- When using `create-pr`: Open pull requests as drafts.", "- Rule 14."}:
        raise SystemExit(f"start must inject the top 10 by sightings: {lines}")
    ranked = json.loads((home / "user" / "lessons.json").read_text(encoding="utf-8"))["entries"]
    if sum(1 for e in ranked.values() if e["id"].startswith("rank-") and e["applied_at"]) != 8:
        raise SystemExit("only lessons injected into a session may count as applied")

    import time
    later = str(int(time.time() * 1000) + 61 * 86_400_000)
    if "Use pnpm" in learn_run(home, ["start", "claude"], {"cwd": cwd}, SRULIK_TOOLKIT_LEARN_NOW=later):
        raise SystemExit("entries unseen for 60 days must not be injected, even with no review")
    learn_deltas(home, [], SRULIK_TOOLKIT_LEARN_NOW=later)
    if "applied yes, recurred_after_apply 1, archived" not in learn_run(home, ["stats", learn_project(home).name]):
        raise SystemExit("entries unseen for 60 days must be archived")

    (repo / "AGENTS.md").write_text("# Agents\n\nuser work in progress\n", encoding="utf-8")
    learn_review_head(home, repo)
    learn_deltas(home, [{"op": "project_fix", "slug": "main-checkout", "summary": "Must not commit here."}], repo)
    if learn_git(repo, "branch", "--list", "srulik-learn/main-checkout") or not learn_git(repo, "status", "--porcelain"):
        raise SystemExit("a project fix must never commit in the user's main checkout")
    learn_git(repo, "checkout", "-q", "--", "AGENTS.md")
    learn_git(repo, "remote", "add", "origin", str(base / "remote.git"))
    worktree = base / "fix"
    learn_git(repo, "worktree", "add", "-q", "--detach", str(worktree), "HEAD")
    learn_run(home, ["capture", "claude"], {"cwd": str(worktree), "prompt": "no, from a worktree"})
    if "from a worktree" not in learn_signals(home)[-1]["text"]:
        raise SystemExit("every worktree of one repository must share one project state")
    (worktree / "AGENTS.md").write_text("# Agents\n\nother work\n", encoding="utf-8")
    learn_review_head(home, repo, worktree)
    own = learn_deltas(home, [{"op": "project_fix", "slug": "own", "summary": "The session's own worktree."}], worktree)
    if own["rejected"] != ["the user's own worktree"]:
        raise SystemExit(f"a project fix must never commit in the worktree the session runs in: {own}")
    learn_review_head(home, repo, launch_at="2999-01-01T00:00:00.000Z")
    old = learn_deltas(home, [{"op": "project_fix", "slug": "old", "summary": "An older worktree."}], worktree)
    if old["rejected"] != ["worktree predates the review"]:
        raise SystemExit(f"a project fix must never commit in a worktree older than the review: {old}")
    learn_review_head(home, repo)
    elsewhere = learn_deltas(home, [{"op": "project_fix", "slug": "elsewhere", "summary": "Run from elsewhere."}], worktree, run_cwd=str(repo))
    if elsewhere["rejected"] != ["not run from the review worktree"]:
        raise SystemExit(f"a project fix must be merged from inside the review worktree: {elsewhere}")
    learn_git(worktree, "commit", "-qam", "moved")
    moved = learn_deltas(home, [{"op": "project_fix", "slug": "moved", "summary": "Moved head."}], worktree)
    if moved["rejected"] != ["worktree is not at the review commit"]:
        raise SystemExit(f"a project fix must come from a worktree still at the review commit: {moved}")
    learn_git(worktree, "checkout", "-q", "--detach", "main")
    hook = pathlib.Path(learn_git(repo, "rev-parse", "--path-format=absolute", "--git-common-dir")) / "hooks" / "pre-commit"
    hook.parent.mkdir(exist_ok=True)
    ran = base / "hook-ran"
    hook.write_text(f"#!/bin/sh\ntouch '{ran.as_posix()}'\nexit 1\n", encoding="utf-8")
    hook.chmod(0o755)
    (worktree / "AGENTS.md").write_text("# Agents\n\nbad date blocks this\n", encoding="utf-8")
    blocked = learn_deltas(home, [{"op": "project_fix", "slug": "blocked", "summary": "Blocked commit."}], worktree, GIT_AUTHOR_DATE="not a date")
    if blocked["rejected"] != ["commit failed"] or learn_git(repo, "branch", "--list", "srulik-learn/blocked"):
        raise SystemExit("a failed commit must not leave its branch behind")
    learn_git(worktree, "checkout", "-q", "--detach", "main")
    learn_git(worktree, "reset", "-q", "--hard")
    shutil.copy2(hook, hook.with_name("post-checkout"))
    (worktree / "AGENTS.md").write_text("# Agents\n\nRun `npm test` before finishing.\n", encoding="utf-8")
    (worktree / ".srulik-learn").mkdir()
    (worktree / ".srulik-learn" / "signals.jsonl").write_text("", encoding="utf-8")
    learn_deltas(home, [{"op": "project_fix", "slug": "add-test-command", "summary": "Point AGENTS.md at the test command."},
                        {"op": "project_fix", "slug": "second", "summary": "Second fix."}], worktree)
    if not learn_git(repo, "branch", "--list", "srulik-learn/add-test-command") or learn_git(repo, "status", "--porcelain"):
        raise SystemExit("a project fix must land on a local branch and leave the main worktree clean")
    if ran.exists():
        raise SystemExit("a project fix commit must never run repository hooks the review could edit")
    hook.unlink()
    hook.with_name("post-checkout").unlink()
    if ".srulik-learn" in learn_git(repo, "show", "--name-only", "srulik-learn/add-test-command"):
        raise SystemExit("review inputs must not be committed")
    record = json.loads(state_file.read_text(encoding="utf-8"))
    if [b["branch"] for b in record["branches"]] != ["srulik-learn/add-test-command"] or "pr_dry" in record["branches"][0]:
        raise SystemExit("one project fix per review, and no draft PR without opt-in")
    if "only one project_fix per review" not in [r["reason"] for r in record["rejected"]]:
        raise SystemExit("a second project fix must be rejected")
    if "srulik-learn/add-test-command: Point AGENTS.md" not in learn_run(home, ["start", "claude"], {"cwd": cwd}):
        raise SystemExit("start must list pending fix branches")

    learn_git(worktree, "checkout", "-q", "--detach", "main")
    (worktree / "README.md").write_text("Tests: npm test\n", encoding="utf-8")
    learn_deltas(home, [{"op": "project_fix", "slug": "readme-tests", "summary": "Document tests."}], worktree, SRULIK_TOOLKIT_LEARN_PRS="1")
    pr = [b for b in json.loads(state_file.read_text(encoding="utf-8"))["branches"] if b["branch"] == "srulik-learn/readme-tests"][0]
    if not any(step.startswith("gh pr create --draft") for step in pr.get("pr_dry", [])):
        raise SystemExit("SRULIK_TOOLKIT_LEARN_PRS=1 must open a draft PR")
    node_null = r"\\.\nul" if os.name == "nt" else "/dev/null"
    if not any(f"core.hooksPath={node_null} push --no-verify" in step for step in pr["pr_dry"]):
        raise SystemExit("the fix branch push must not run repository hooks")
