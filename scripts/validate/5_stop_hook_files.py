
stop_input = {"hook_event_name": "Stop", "stop_hook_active": False}
for message in [
    "Blocked: GitHub sign-in needs an approved email code.",
    "Blocked: no access to GitHub.",
    "Blocked: not authenticated.",
    "I'm blocked by a missing repository permission.",
    "I can’t proceed with the available access.",
]:
    output = json.loads(stop_check(stop_input | {"last_assistant_message": message}))
    if output.get("decision") != "block" or "authorized route" not in output.get("reason", ""):
        raise SystemExit(f"Stop hook did not deliver recovery context for {message!r}")
for message in [
    "Completed: the GitHub login works.",
    "Completed: the task was blocked earlier, but the login now works.",
    "Blocked: none; all checks passed.",
    "**Blocked:** none; all checks passed.",
    "Previously blocked by login; this is resolved.",
    "Blocked: missing permission (resolved).",
    "Blocked: missing permission.\nResolved: signed in successfully; task complete.",
    "Example output:\n```text\nBlocked: a missing permission.\n```\nThe task is complete.",
]:
    if stop_check(stop_input | {"last_assistant_message": message}):
        raise SystemExit(f"Stop hook misclassified completed work: {message!r}")
blocked_input = stop_input | {"last_assistant_message": "Blocked: access is unavailable."}
if stop_check(blocked_input | {"stop_hook_active": True}):
    raise SystemExit("Stop hook must allow the second stop")
if stop_check(blocked_input, disabled=True):
    raise SystemExit("Stop hook opt-out must be silent")
if stop_check(stop_input) or stop_check(blocked_input | {"hook_event_name": "SubagentStop"}) or stop_check("{"):
    raise SystemExit("Stop hook must fail open on missing, unrelated, or malformed input")
print("Blocked Stop hook passed")

requests = {}
class VersionHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        requests[self.path] = requests.get(self.path, 0) + 1
        if self.path == "/slow":
            time.sleep(0.2)
        body = {"/equal": version, "/new": "9.9.9", "/bad": "not-a-version", "/slow": "9.9.9"}.get(self.path)
        self.send_response(200 if body else 404)
        self.end_headers()
        try:
            self.wfile.write((body or "missing").encode())
        except BrokenPipeError:
            pass
    def log_message(self, *_):
        pass

server = ThreadingHTTPServer(("127.0.0.1", 0), VersionHandler)
threading.Thread(target=server.serve_forever, daemon=True).start()
base_url = f"http://127.0.0.1:{server.server_port}"
hint_start = "Srulik Toolkit skills:"

def check(endpoint, data_root, timeout="2000", cursor=False):
    env = {k: v for k, v in os.environ.items() if k not in {"CURSOR_PLUGIN_ROOT", "PLUGIN_ROOT", "CLAUDE_PLUGIN_ROOT"}} | {
        "CURSOR_PLUGIN_ROOT" if cursor else "PLUGIN_ROOT": str(plugin),
        "PLUGIN_DATA": str(data_root),
        "SRULIK_TOOLKIT_VERSION_URL": base_url + endpoint,
        "SRULIK_TOOLKIT_VERSION_TIMEOUT_MS": timeout,
    }
    result = subprocess.run([node, str(plugin / "hooks" / "check-version.js")], env=env, capture_output=True, text=True, timeout=30, check=True)
    stdout = result.stdout
    if cursor:
        try:
            payload = json.loads(stdout) if len(stdout.splitlines()) == 1 else None
        except json.JSONDecodeError:
            payload = None
        if not isinstance(payload, dict) or set(payload) != {"additional_context"}:
            raise SystemExit(f"Cursor startup output must be one additional_context object: {stdout}")
        stdout = payload["additional_context"] + "\n"
    if result.stderr or not stdout.startswith(hint_start):
        raise SystemExit(f"version checker did not preserve startup hint: {result.stderr or stdout}")
    advertised = set(stdout.splitlines()[0].split("skills: ", 1)[1].split(". Read", 1)[0].split(", "))
    if advertised != expected:
        raise SystemExit(f"startup hint differs from packaged skills: {sorted(advertised ^ expected)}")
    return stdout

with tempfile.TemporaryDirectory() as temporary:
    data = pathlib.Path(temporary)
    startup = check("/equal", data)
    advertised = startup.split(hint_start, 1)[1].split(". Read relevant skills", 1)[0].strip()
    if set(advertised.split(", ")) != expected:
        raise SystemExit("startup hint must advertise every packaged skill")
    if "is available" in startup:
        raise SystemExit("equal versions must not suggest an upgrade")
with tempfile.TemporaryDirectory() as temporary:
    data = pathlib.Path(temporary)
    if "9.9.9 is available" not in check("/new", data):
        raise SystemExit("version mismatch must suggest an upgrade")
    check("/new", data)
    if requests.get("/new") != 1:
        raise SystemExit("fresh cached version must prevent a second request")
with tempfile.TemporaryDirectory() as temporary:
    if "is available" in check("/equal", pathlib.Path(temporary), cursor=True):
        raise SystemExit("Cursor equal versions must not suggest an upgrade")
with tempfile.TemporaryDirectory() as temporary:
    if f"\nSrulik Toolkit {version} is installed; 9.9.9 is available" not in check("/new", pathlib.Path(temporary), cursor=True):
        raise SystemExit("Cursor version mismatch must join the upgrade notice to the hint")
with tempfile.TemporaryDirectory() as temporary:
    if "is available" in check("/bad", pathlib.Path(temporary)):
        raise SystemExit("invalid upstream version must be silent")
with tempfile.TemporaryDirectory() as temporary:
    if "is available" in check("/slow", pathlib.Path(temporary), "50"):
        raise SystemExit("timed-out upstream request must be silent")
server.shutdown()
print("Startup version checker passed")

for relative in [
    "skills/to-project/EXTEND.md",
    "skills/to-project/GLOSSARY-FORMAT.md",
    "skills/to-project/templates.md",
    "skills/to-project/base-skills/capture-to-project/SKILL.md",
    "skills/to-project/base-skills/tidy-project/SKILL.md",
    "skills/review-pro-max/code-reviewer.md",
    "skills/tdd/tests.md",
    "skills/tdd/mocking.md",
    "skills/stop-slop/LICENSE",
    "skills/show-me/LICENSE",
    "skills/retro/LICENSE",
]:
    if not (plugin / relative).is_file():
        raise SystemExit(f"missing bundled resource: {relative}")

forbidden = [
    "autodesk",
    "zachbonfil",
    "bonfilz",
    "Team" + "Create",
    "Send" + "Message",
    "Task" + "Create",
    "Task" + "Update",
    "~/" + ".config/agent-rules",
    "~/" + ".claude",
    "~/" + ".codex",
    "AECCON-",
    "WPX-",
]
for path in skill_root.rglob("*"):
    if not path.is_file():
        continue
    text = path.read_text(encoding="utf-8", errors="ignore")
    if re.search(r"/Users/[A-Za-z0-9_.-]+|/home/[A-Za-z0-9_.-]+|[A-Za-z]:[\\/]Users[\\/]", text):
        raise SystemExit(f"personal filesystem path: {path.relative_to(root)}")
    for token in forbidden:
        if token.lower() in text.lower():
            raise SystemExit(f"non-portable token {token!r}: {path.relative_to(root)}")
    if path.suffix == ".md":
        # Example code may show paths for a user's project, not bundled resources.
        prose = re.sub(r"```.*?```|`[^`\n]+`", "", text, flags=re.DOTALL)
        for target in re.findall(r"\]\(([^)\s]+)\)", prose):
            if re.match(r"[a-zA-Z][a-zA-Z0-9+.-]*:", target) or target.startswith("#"):
                continue
            resource = (path.parent / target.split("#", 1)[0]).resolve()
            if not resource.is_relative_to(plugin.resolve()) or not resource.exists():
                raise SystemExit(f"missing or external bundled resource {target!r}: {path.relative_to(root)}")

notice = (root / "NOTICE.md").read_text(encoding="utf-8")
license_text = (plugin / "skills" / "stop-slop" / "LICENSE").read_text(encoding="utf-8")
show_me_license = (plugin / "skills" / "show-me" / "LICENSE").read_text(encoding="utf-8")
retro_license = (plugin / "skills" / "retro" / "LICENSE").read_text(encoding="utf-8")
if not all(token in notice for token in ["2024 Zach Bonfil", "CodeRabbit", "Hardik Pandya", "MIT", "stop-slop/LICENSE", "HumanLayer", "2026", "https://github.com/humanlayer/skills", "show-me/LICENSE"]):
    raise SystemExit("missing source attribution in NOTICE.md")
if not all(token in license_text for token in ["MIT License", "2025 Hardik Pandya", "Permission is hereby granted", "THE SOFTWARE IS PROVIDED"]):
    raise SystemExit("missing retained stop-slop copyright or MIT terms")
if not all(token in show_me_license for token in ["MIT License", "Copyright (c) 2026 HumanLayer", "Permission is hereby granted", "THE SOFTWARE IS PROVIDED"]):
    raise SystemExit("missing retained show-me copyright or MIT terms")
if not all(token in notice for token in ["Matt Pocock", "https://github.com/mattpocock/skills", "retro/LICENSE"]):
    raise SystemExit("missing retro source attribution in NOTICE.md")
if not all(token in retro_license for token in ["MIT License", "Copyright (c) 2026 Matt Pocock", "Permission is hereby granted", "THE SOFTWARE IS PROVIDED"]):
    raise SystemExit("missing retained retro copyright or MIT terms")

tour = (skill_root / "tour" / "SKILL.md").read_text(encoding="utf-8")
tour_contract = [
    "Invoke `$research` for every tour",
    "very thorough",
    "chat-only output",
    "after the initial research",
    "materially change the tour's scope, chronology, or interpretation",
    "invoke `$show-me` for every completed tour",
    "OS-managed temporary path outside the repository",
    "Context-encode every untrusted topic, repository, and research value",
    "keep scripts static and trusted, and load no remote resources",
    "OS-managed temporary Markdown file outside the repository",
    "verified facts, user decisions, inferences, and unresolved gaps",
]
if not all(token in tour for token in tour_contract):
    raise SystemExit("tour is missing its research, grilling, visualization, or delivery contract")

for skill_name in expected:
    if f"skills/{skill_name}/SKILL.md" not in readme:
        raise SystemExit(f"README is missing skill: {skill_name}")
if "Twenty-three focused skills" not in readme or "/hooks" not in readme:
    raise SystemExit("README must document twenty-three skills and Codex hook trust")

outcome_dod_contract = "Outcome and Definition of Done gate"
create_plan_text = (skill_root / "create-plan" / "SKILL.md").read_text(encoding="utf-8")
grilling_text = (skill_root / "create-plan" / "references" / "grilling.md").read_text(encoding="utf-8")
for relative, text in [
    ("skills/create-plan/SKILL.md", create_plan_text),
    ("skills/create-plan/references/grilling.md", grilling_text),
]:
    if outcome_dod_contract not in text:
        raise SystemExit(f"missing outcome and Definition of Done gate: {relative}")
    for required_phrase in [
        "Expected outcome",
        "Definition of Done",
        "separate grill questions",
        "occupy two slots",
        "authoritative",
        "Neither item may be deferred",
        "The readiness gate cannot pass while",
    ]:
        if required_phrase not in text:
            raise SystemExit(f"missing {required_phrase!r} from outcome and DoD contract: {relative}")
