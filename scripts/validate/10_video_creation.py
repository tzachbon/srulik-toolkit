# video-creation: trigger, steps, trust rules, brand-agnostic look, and a runnable template.
video_dir = skill_root / "video-creation"
video_template = video_dir / "assets" / "template"
video_read = lambda path: " ".join(path.read_text(encoding="utf-8").split())
video_core = video_read(video_dir / "SKILL.md")
video_brand = video_read(video_dir / "references" / "brand-feel.md")
video_pipeline = video_read(video_dir / "references" / "pipeline.md")

for token in [
    "name: video-creation",
    "product, demo, feature, walkthrough, launch, or PM video",
    "For a single diagram or still visual, use `show-me`",
    "never edit the bundled copy",
    "name it and stop before capture",
    "a number without a source stays off screen",
    "Edit on-screen copy with `stop-slop`",
    "The capture changes no data",
    "abort every request that is not a read",
    "answer event and analytics posts locally",
    "cancel dialogs instead of confirming them",
    "blur people's names and customer data",
    "never print them",
    "from the brand's own sources",
    "`seek(t)` sets every element from time alone, with no CSS transitions or timers",
    "Key footage cuts to named marks",
    "Render and inspect single frames before a full render",
    "bar lines land on the scene cuts",
    "Update the cut map after any timing change",
    "Show the user the contact sheet and stills before calling the video done",
    "**Real footage only.**",
    "**Verbatim quotes.**",
    "**Sourced numbers.**",
    "**Capture changes no data.**",
    "**Original music only.**",
    "keep them out of shared repositories",
    "`ui-ux-review`",
    "the number-to-source table",
    "blocked-request log",
]:
    if token not in video_core:
        raise SystemExit(f"video-creation skill missing contract: {token!r}")
if re.search(r"t3_[a-z_]+|\bT3\b|Claude Code|\bCodex\b|\bCursor\b|\.claude/|\.codex/|Bash\(", video_core):
    raise SystemExit("video-creation core must stay host-agnostic")
if (video_dir / "SKILL.md").stat().st_size >= 5_000:
    raise SystemExit("video-creation core must stay under 5 KB")

for token in [
    "the brand's own public sources", "Never invent a brand value", "none ship with this skill",
    "**one accent**", "weights 400, 500 and 700 only", "clear space", "**Safe margin** of 96 px",
    "**Zoom into the region that matters**", "rise 24 px", "**cubic ease-out**", "**Stagger**",
    "**No bounce**", "readable in about 2 s", "| Title |", "| Problem |", "| Demo |", "| Stat |",
    "| How it works |", "| Next steps |", "| End |", "Music as a supporting bed", "Fix the tokens",
]:
    if token not in video_brand:
        raise SystemExit(f"video-creation brand-feel reference missing contract: {token!r}")
for token in [
    "Let only `GET`, `HEAD` and `OPTIONS` through", "Abort every other request", "locally with `204`",
    "then cancel them", "Blur people's names", "never print them", "word for word",
    "make it throw if a line is not found verbatim", "Pick `BAR` so bar lines land on the cuts",
    "`-shortest`", "`h264` and `aac` at 1920x1080",
]:
    if token not in video_pipeline:
        raise SystemExit(f"video-creation pipeline reference missing contract: {token!r}")

video_files = {p.relative_to(video_dir).as_posix() for p in video_dir.rglob("*") if p.is_file()}
video_expected = {"SKILL.md", "agents/openai.yaml", "references/brand-feel.md", "references/pipeline.md"} | {
    f"assets/template/{name}" for name in [
        "README.md", "build.sh", "index.html", "timeline.js", "render.mjs", "capture-lib.mjs",
        "record-example.mjs", "music.mjs", "contact-sheet.mjs",
    ]}
if video_files != video_expected:
    raise SystemExit(f"video-creation files differ: {sorted(video_files ^ video_expected)}")

# Public repo: no company names, product names, or private hosts from the source video; no brand assets.
for video_name in sorted(video_files):
    video_text = (video_dir / video_name).read_text(encoding="utf-8")
    if re.search(r"(?i)\b(autodesk|forma|artifakt|pendo|acc|zachbonfil)\b", video_text) or re.search(r"\bExo\b", video_text):
        raise SystemExit(f"video-creation must not name the source company or product: {video_name}")
    for video_host in re.findall(r"https?://([^/\s'\"`)]+)", video_text):
        if video_host != "example.com" and not video_host.endswith(".example.com"):
            raise SystemExit(f"video-creation may only use example.com hosts: {video_name}: {video_host}")
    if re.search(r"(?<![\w.])url\(|@font-face\s*\{", video_text):
        raise SystemExit(f"video-creation must not reference bundled fonts or images: {video_name}")

video_src = {name: (video_template / name).read_text(encoding="utf-8") for name in [
    "capture-lib.mjs", "record-example.mjs", "render.mjs", "contact-sheet.mjs", "timeline.js",
    "music.mjs", "build.sh", "index.html",
]}
if "require(process.env.PLAYWRIGHT_CORE || 'playwright-core')" not in video_src["capture-lib.mjs"]:
    raise SystemExit("video-creation capture-lib must resolve PLAYWRIGHT_CORE, then playwright-core")
for video_name in ["render.mjs", "contact-sheet.mjs"]:
    if "import { chromium } from './capture-lib.mjs';" not in video_src[video_name] or "require(" in video_src[video_name]:
        raise SystemExit(f"video-creation {video_name} must take chromium from capture-lib")
for token in ["['GET', 'HEAD', 'OPTIONS'].includes(req.method())", "route.fulfill({ status: 204", "return route.abort();", "blur(6px)", "https://app.example.com"]:
    if token not in video_src["record-example.mjs"]:
        raise SystemExit(f"video-creation record-example missing safety pattern: {token!r}")
for token in ["'libx264'", "'yuv420p'", "'+faststart'", "'--stills'", "const FPS = 30;"]:
    if token not in video_src["render.mjs"]:
        raise SystemExit(f"video-creation render missing: {token!r}")
if re.search(r"transition|setTimeout|setInterval|requestAnimationFrame", re.sub(r"//.*", "", video_src["timeline.js"])) or "window.seek = " not in video_src["timeline.js"]:
    raise SystemExit("video-creation timeline must set state from seek(t) without transitions or timers")
if not re.search(r"^const T = \{", video_src["music.mjs"], re.MULTILINE) or "process.argv[2]" not in video_src["music.mjs"]:
    raise SystemExit("video-creation music must start from a scene-time map and take the duration")
if "record-" in video_src["build.sh"].split("\n", 3)[-1] or "-shortest" not in video_src["build.sh"]:
    raise SystemExit("video-creation build must render, mux with -shortest, and not capture")
if "--accent:" not in video_src["index.html"] or "system-ui" not in video_src["index.html"]:
    raise SystemExit("video-creation template must use neutral CSS tokens and system fonts")

for video_name in ["capture-lib.mjs", "record-example.mjs", "render.mjs", "contact-sheet.mjs", "music.mjs", "timeline.js"]:
    subprocess.run([node, "--check", str(video_template / video_name)], check=True, timeout=30)

# Music runs with only Node: a copy writes a stereo 16-bit WAV of exactly the requested length.
with tempfile.TemporaryDirectory() as video_tmp:
    video_copy = pathlib.Path(video_tmp) / "template"
    shutil.copytree(video_template, video_copy)
    video_bare = subprocess.run([node, str(video_copy / "music.mjs")], capture_output=True, text=True, timeout=60)
    if video_bare.returncode == 0 or "Pass the video duration" not in video_bare.stderr:
        raise SystemExit("video-creation music must ask for the duration when it is missing")
    subprocess.run([node, str(video_copy / "music.mjs"), "3"], check=True, capture_output=True, timeout=120)
    video_wav = (video_copy / "out" / "music.wav").read_bytes()
    if video_wav[:4] != b"RIFF" or video_wav[8:12] != b"WAVE" or int.from_bytes(video_wav[22:24], "little") != 2 \
            or int.from_bytes(video_wav[24:28], "little") != 44100 or len(video_wav) != 44 + 3 * 44100 * 4 \
            or not any(video_wav[44 + i] for i in range(44100 * 4, 44100 * 8)):
        raise SystemExit("video-creation music did not write a 3 s stereo 44.1 kHz WAV with sound")
