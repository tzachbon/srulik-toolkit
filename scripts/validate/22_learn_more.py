# Self-learning loop: the T3 Code route, owner-only state and an unwritable state
# home. Reuses the learn_* helpers from 21_learn.py.
with tempfile.TemporaryDirectory() as temporary:
    base = pathlib.Path(temporary)
    home = base / "home"
    repo = learn_repo(base)
    bin_dir = base / "bin"
    bin_dir.mkdir()
    for name in ["t3", "t3.cmd", "t3.exe"]:
        (bin_dir / name).write_text("", encoding="utf-8")
    learn_run(home, ["capture", "claude"], {"cwd": str(repo), "prompt": "no, wrong file"})
    learn_run(home, ["start", "claude"], {"cwd": str(repo)}, T3CODE_THREAD_ID="thread-1", PATH=str(bin_dir) + os.pathsep + os.environ.get("PATH", ""))
    launch = json.loads((learn_project(home) / "state.json").read_text(encoding="utf-8"))["last_launch"]
    if launch["route"] != "t3" or launch["argv"][:3] != ["t3", "thread", "start"] or launch["argv"][-2:] != ["--worktree", "HEAD"]:
        raise SystemExit(f"inside T3 Code the review must start a T3 thread in a worktree: {launch}")
    snapshot = learn_project(home) / "signals.review.jsonl"
    learn_run(home, ["capture", "claude"], {"cwd": str(repo), "prompt": "no, later signal"})
    offset = json.loads((learn_project(home) / "state.json").read_text(encoding="utf-8")).get("review_offset")
    if not snapshot.is_file() or "later signal" in snapshot.read_text(encoding="utf-8") or offset != snapshot.stat().st_size:
        raise SystemExit("the T3 review must read a snapshot taken at launch")
    if os.name != "nt":
        shared = [p for p in [home, *home.rglob("*")] if p.stat().st_mode & 0o077]
        if shared:
            raise SystemExit(f"learn state must be readable by its owner only: {shared}")

with tempfile.TemporaryDirectory() as temporary:
    home = pathlib.Path(temporary) / "home"
    repo = learn_repo(pathlib.Path(temporary))
    command = "NPM_TOKEN=abc123 AWS_SECRET_ACCESS_KEY='s3 cr3t' DATABASE_URL=postgres://user:p@ss/w9@host/db npm test --password hunter3 password=\"my pass\""
    error = ('Exit code 1 {"api_key": "abcd1234efgh"} curl -u admin:s3cret -H "Authorization: Basic dXNlcjpw" redis://:topsecret@localhost:6379 '
             '{"Authorization": "Basic QXV0aDE="} headers: {Authorization: "Basic QXV0aDI="} curl -u "admin:s3 cret2" -uroot:pw3x password="one \\"two\\" three"')
    learn_run(home, ["capture", "claude"], {"hook_event_name": "PostToolUseFailure", "cwd": str(repo), "tool_input": {"command": command}, "error": error})
    leaked = learn_signals(home)[-1]["text"]
    secrets = ["abc123", "s3 cr3t", "cr3t", "ss/w9", "hunter3", "my pass", "pass\"", "abcd1234efgh", "s3cret", "dXNlcjpw", "topsecret", "QXV0aDE", "QXV0aDI", "cret2", "pw3x", "two", "three"]
    if [s for s in secrets if s in leaked] or "npm test" not in leaked or "localhost:6379" not in leaked:
        raise SystemExit(f"redaction missed a secret: {leaked}")

if os.name != "nt" and os.geteuid() != 0:
    import time
    with tempfile.TemporaryDirectory() as temporary:
        home = pathlib.Path(temporary) / "home"
        (home / "user").mkdir(parents=True)
        at = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())
        entry = {"id": "ro", "text": "Read-only rule.", "seen": 2, "first_seen": at, "last_seen": at, "applied_at": None, "recurred_after_apply": 0, "archived": False}
        (home / "user" / "lessons.json").write_text(json.dumps({"entries": {"ro": entry}}), encoding="utf-8")
        home.chmod(0o500)
        try:
            started = time.monotonic()
            out = learn_run(home, ["start", "claude"], {"cwd": temporary})
            if "- Read-only rule." not in out or time.monotonic() - started > 2.5:
                raise SystemExit("an unwritable state home must still inject lessons within the hook timeout")
        finally:
            home.chmod(0o700)
print("Self-learning loop passed")
