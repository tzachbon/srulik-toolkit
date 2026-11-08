#!/usr/bin/env python3
"""Update every Srulik Toolkit install this account has, then verify what actually loads.

Usage: update-installs.py [--check] [--via COMMAND ...]

--check verifies without changing anything. --via runs this script through a command that
starts Python elsewhere, e.g. "ssh my-pc python" or "sudo -n -u other-user -H python3".
Exits 1 when any update or check fails. See README "Every installation at once".
One file on purpose: --via sends it to the other Python on standard input.
"""
import argparse
import getpass
import json
import os
import platform
import re
import shlex
import shutil
import subprocess
import sys
import tempfile
import threading
from pathlib import Path

PLUGIN = "srulik-toolkit@srulik-toolkit"
MARKETPLACE = "srulik-toolkit"
PREFIX = "srulik-toolkit:"
CACHE_LINK = re.compile(r"^(.*[\\/]plugins[\\/]cache[\\/]srulik-toolkit[\\/]srulik-toolkit[\\/])([^\\/]+)([\\/]skills[\\/].+)$")
RUNTIME = re.compile(r"^\.in_use/|^\.orphaned_at$|(^|/)__pycache__/")  # Claude and Python add these
problems = []


def link_target(path):
    """A symlink's target as written; Windows reports it with a \\\\?\\ prefix."""
    target = os.readlink(path)
    return target[4:] if target.startswith("\\\\?\\") else target


def say(message):
    print(message, flush=True)


def fail(message):
    problems.append(message)
    say("  FAIL " + message)


def run(args, cwd=None, stdin=None, timeout=300):
    return subprocess.run(args, cwd=str(cwd or Path.home()), input=stdin, capture_output=True, text=True,
                          encoding="utf-8", errors="replace", timeout=timeout)


def native(args, cwd=None):
    result = run(args, cwd)
    if result.returncode:
        fail(f"{' '.join(args[1:])} exited {result.returncode}: {(result.stderr or result.stdout).strip()[:400]}")
    return result.returncode == 0


def expected(marketplace_root):
    """The plugin folder, version and {skill: description} of a marketplace checkout."""
    plugin = Path(marketplace_root) / "plugins" / "srulik-toolkit"
    skills = {}
    for skill in sorted(plugin.glob("skills/*/SKILL.md")):
        match = re.search(r"^description:[ \t]*(.*)$", skill.read_text(encoding="utf-8"), re.M)
        skills[skill.parent.name] = match.group(1).strip() if match else ""
    return plugin, (plugin / "VERSION").read_text(encoding="utf-8").strip(), skills


def differing_files(source, installed):
    """Source files missing from installed or different there, ignoring line endings."""
    # ponytail: CRLF folding hits binaries too; fine until one differs only there.
    differing = []
    for file in sorted(source.rglob("*")):
        if file.is_file():
            relative = file.relative_to(source)
            copy = installed / relative
            if not copy.is_file() or copy.read_bytes().replace(b"\r\n", b"\n") != file.read_bytes().replace(b"\r\n", b"\n"):
                differing.append(relative.as_posix())
    return differing


def missing_skills(found, skills, shown):
    """Skills a fresh process does not show with the current description."""
    descriptions = {re.sub(r" \((user|project)\)$", "", text) for text in found.values()}
    return [name for name, description in skills.items()
            if found.get(PREFIX + name) != shown(description) and description not in descriptions]


def toml_section(text, header):
    """One [header] table's body."""
    # ponytail: not a TOML parser (none before 3.11); reads key = "value" lines only.
    match = re.search(r"^\[" + re.escape(header) + r"\][ \t]*(#[^\n]*)?$(.*?)(?=^\[|\Z)", text, re.M | re.S)
    return match.group(2) if match else None


def toml_value(section, key):
    match = re.search(r"^" + key + r"""\s*=\s*("(?:[^"\\]|\\.)*"|'[^']*')""", section or "", re.M)
    return match and (json.loads(match.group(1)) if match.group(1)[0] == '"' else match.group(1)[1:-1])


def report_installed(name, installed, version, plugin, want):
    if installed.name != want:
        fail(f"{name} installed {installed.name}, source has {want}")
    differing = differing_files(plugin, installed) + [f for f in differing_files(installed, plugin) if not RUNTIME.search(f)]
    if differing:
        fail(f"{name} install {installed} differs from source in {len(differing)} files, e.g. {differing[:3]}")


def describe_source(root):
    head = run(["git", "-C", str(root), "rev-parse", "--short", "HEAD"]) if shutil.which("git") else None
    return f"{root} @ {head.stdout.strip()}" if head and head.returncode == 0 else str(root)


def claude_commands(exe, cwd):
    """Commands a fresh Claude process discovers in cwd (initialize handshake, no model turn)."""
    request = json.dumps({"type": "control_request", "request_id": "srulik", "request": {"subtype": "initialize", "hooks": {}}})
    result = run([exe, "-p", "--input-format", "stream-json", "--output-format", "stream-json", "--verbose",
                  "--no-session-persistence"], cwd, request + "\n", timeout=180)
    for line in result.stdout.splitlines():
        try:
            item = json.loads(line)
        except ValueError:
            continue
        if item.get("type") == "control_response" and item["response"].get("subtype") == "success":
            return {command["name"]: command.get("description", "") for command in item["response"]["response"]["commands"]}
    return None


def update_claude(check, cache_roots, later):
    exe = shutil.which("claude")
    listing = run([exe, "plugin", "list", "--json"]) if exe else None
    if not listing or listing.returncode:
        say("claude: not found, skipped" if not exe else "claude: plugin list failed, skipped")
        if listing:
            fail("claude plugin list: " + (listing.stderr or listing.stdout).strip()[:400])
        return None
    entries = [entry for entry in json.loads(listing.stdout) if entry["id"] == PLUGIN]
    if not entries:
        say("claude: srulik-toolkit not installed, skipped")
        return None
    live = [entry for entry in entries if entry.get("projectPath") and Path(entry["projectPath"]).is_dir()]
    if not check:
        native([exe, "plugin", "marketplace", "update", MARKETPLACE])
        for entry in [entry for entry in entries if entry["scope"] == "user"] + live:
            native([exe, "plugin", "update", PLUGIN, "--scope", entry["scope"], "--json"], entry.get("projectPath"))
        entries = [entry for entry in json.loads(run([exe, "plugin", "list", "--json"]).stdout) if entry["id"] == PLUGIN]
    marketplaces = json.loads(run([exe, "plugin", "marketplace", "list", "--json"]).stdout)
    source = next((item for item in marketplaces if item["name"] == MARKETPLACE), {})
    root = source.get("installLocation") or source.get("path")
    if not root:
        fail("claude: no srulik-toolkit marketplace")
        return None
    plugin, version, skills = expected(root)
    say(f"claude: source {describe_source(root)}, version {version}")
    user = next((entry for entry in entries if entry["scope"] == "user"), None)
    for entry in [user] if user else entries:
        installed = Path(entry["installPath"])
        report_installed("claude " + entry["scope"], installed, version, plugin, version)
        cache_roots[CACHE_LINK.match(str(installed / "skills" / "x")).group(1)] = installed.name
    stale = [entry for entry in entries if entry in live and entry["version"] != version]
    if stale:
        say(f"  note: {len(stale)} project records list an older version after the native update; "
            "discovery tells versions apart only where a skill description changed")
    targets = ([(None, user)] if user else []) + [(Path(entry["projectPath"]), entry) for entry in live]
    places = [place for place, entry in targets if entry.get("enabled", True)]
    if len(places) < len(targets):
        say(f"  note: {len(targets) - len(places)} disabled, discovery skipped there")
    if places:
        later.append(lambda: verify_claude(exe, places, skills))
    return plugin


def verify_claude(exe, places, skills):
    for place in places:
        found = claude_commands(exe, place)
        if found is None:
            fail(f"claude discovery failed in {place or 'home'}")
            continue
        missing = missing_skills(found, skills, lambda description: "(srulik-toolkit) " + description)
        if missing:
            fail(f"claude in {place or 'home'} does not load the current {missing[:5]}")
    say(f"claude: checked discovery of {len(skills)} skills in {'home and ' if None in places else ''}"
        f"{len([place for place in places if place])} projects")


def codex_skills(exe, cwd):
    """Skills a fresh Codex app-server lists for cwd, forcing a reload from disk."""
    process = subprocess.Popen([exe, "app-server", "--stdio"], cwd=str(cwd), stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                               stderr=subprocess.DEVNULL, text=True, encoding="utf-8", errors="replace")
    timer = threading.Timer(180, process.kill)
    timer.start()
    try:
        for message in ({"id": 1, "method": "initialize", "params": {"clientInfo": {"name": "srulik-update-installs", "version": "1"}}},
                        {"id": 2, "method": "skills/list", "params": {"cwds": [str(cwd)], "forceReload": True}}):
            process.stdin.write(json.dumps(message) + "\n")
        process.stdin.flush()
        for line in process.stdout:  # stdin stays open: app-server quits on end of input
            try:
                item = json.loads(line)
            except ValueError:
                continue
            if item.get("id") == 2:
                return item.get("result", {}).get("data", [{}])[0]
        return None
    finally:
        timer.cancel()
        process.stdin.close()
        try:
            process.wait(timeout=15)
        except subprocess.TimeoutExpired:
            process.kill()


def update_codex(check, cache_roots):
    exe = shutil.which("codex")
    home = Path(os.environ.get("CODEX_HOME") or Path.home() / ".codex")
    config = home / "config.toml"
    text = config.read_text(encoding="utf-8-sig") if config.is_file() else ""
    plugin_table = toml_section(text, 'plugins."' + PLUGIN + '"')
    market = toml_section(text, "marketplaces." + MARKETPLACE)
    if not exe or plugin_table is None or market is None:
        say("codex: srulik-toolkit not installed, skipped")
        return None
    if re.search(r"^enabled\s*=\s*false", plugin_table, re.M):
        say("codex: srulik-toolkit is disabled here, skipped")
        return None
    git = toml_value(market, "source_type") == "git"
    root = home / ".tmp" / "marketplaces" / MARKETPLACE if git else Path(toml_value(market, "source") or "")
    if not check:
        if git:
            native([exe, "plugin", "marketplace", "upgrade", MARKETPLACE, "--json"])
        native([exe, "plugin", "add", PLUGIN, "--json"])
    plugin, version, skills = expected(root)
    say(f"codex: source {describe_source(root)}, version {version}")
    listed = codex_skills(exe, Path.home())
    if listed is None:
        fail("codex discovery failed")
        return plugin
    errors = [error for error in listed.get("errors", []) if "srulik" in json.dumps(error)]
    if errors:
        fail(f"codex discovery errors: {errors[:3]}")
    ours = [skill for skill in listed.get("skills", []) if skill.get("pluginId") == PLUGIN and skill.get("enabled")]
    caches = {Path("".join(CACHE_LINK.match(skill["path"]).group(1, 2))) for skill in ours}
    if len(caches) != 1:
        fail(f"codex loads toolkit skills from {len(caches)} installs: {sorted(map(str, caches))}")
        return plugin
    installed = caches.pop()
    report_installed("codex", installed, version, plugin, version)
    cache_roots[CACHE_LINK.match(str(installed / "skills" / "x")).group(1)] = installed.name
    missing = missing_skills({skill["name"]: skill.get("description", "") for skill in ours}, skills, str)
    if missing:
        fail(f"codex does not load the current {missing[:5]}")
    say(f"  checked files and discovery of {len(skills)} skills")
    return plugin


def repoint_aliases(folders, cache_roots, check):
    """Repoint skill symlinks into an older toolkit cache."""
    # ponytail: symlinks only, not Windows junctions; add those if one turns up.
    for folder in folders:
        if not folder.is_dir():
            continue
        for link in sorted(folder.iterdir()):
            match = CACHE_LINK.match(link_target(link)) if link.is_symlink() else None
            if not match or match.group(1) not in cache_roots or match.group(2) == cache_roots[match.group(1)]:
                continue
            target = match.group(1) + cache_roots[match.group(1)] + match.group(3)
            if not Path(target).exists():
                fail(f"alias {link} points at {match.group(2)}; {target} does not exist")
            elif check:
                fail(f"alias {link} points at {match.group(2)}, not {cache_roots[match.group(1)]}")
            else:
                temporary = link.with_name("." + link.name + ".srulik-update")
                if temporary.is_symlink() or temporary.exists():
                    temporary.unlink()
                os.symlink(target, temporary, target_is_directory=True)
                try:
                    os.replace(temporary, link)
                except PermissionError:  # Windows keeps a directory symlink
                    os.unlink(link)
                    os.replace(temporary, link)
                say(f"  alias {link} now points at {target}")


def skill_differs(source, copy):
    """Whether a copy's files differ from source, except its own name line."""
    files = sorted(file.relative_to(source) for file in source.rglob("*") if file.is_file())
    if files != sorted(file.relative_to(copy) for file in copy.rglob("*") if file.is_file()):
        return True
    for relative in files:
        a, b = ((root / relative).read_bytes().replace(b"\r\n", b"\n") for root in (source, copy))
        if relative == Path("SKILL.md"):  # not bundled skills
            a, b = (re.sub(rb"^name:.*$", b"", text, count=1, flags=re.M) for text in (a, b))
        if a != b:
            return True
    return False


def refresh_copies(folders, plugin, cache_roots, check):
    """Refresh copies of toolkit skills that match an installed version."""
    versions = [Path(root) / version for root in cache_roots for version in os.listdir(root)]
    seen = set()
    for folder in folders:
        for skill in sorted(folder.iterdir()) if folder.is_dir() else []:
            source = plugin / "skills" / skill.name
            try:
                if not source.is_dir() or (skill.is_symlink() and CACHE_LINK.match(link_target(skill))):
                    continue
                real = skill.resolve()
                if real in seen or not (real / "SKILL.md").is_file() or not skill_differs(source, real):
                    continue
            except OSError as error:  # a Windows junction
                say(f"  note: skipped {skill}: {error}")
                continue
            seen.add(real)
            if not any((old / "skills" / skill.name).is_dir() and not skill_differs(old / "skills" / skill.name, real) for old in versions):
                say(f"  note: {skill} matches no installed toolkit version, left as is")
            elif check:
                fail(f"copied skill {skill} is out of date")
            elif not os.access(real.parent, os.W_OK):
                fail(f"copied skill {real} is out of date and not writable here; run as its owner to refresh it")
            else:
                name = re.search(rb"^name:.*$", (real / "SKILL.md").read_bytes(), re.M)
                fresh = real.with_name(f".{real.name}.srulik-update")
                try:
                    shutil.rmtree(fresh, ignore_errors=True)
                    shutil.copytree(source, fresh)
                    if name:
                        top = fresh / "SKILL.md"
                        top.write_bytes(re.sub(rb"^name:.*$", name.group(0), top.read_bytes(), count=1, flags=re.M))
                    shutil.copymode(real, fresh)  # e.g. a shared copy
                    shutil.rmtree(swap(fresh, real), ignore_errors=True)
                    say(f"  copied skill {real} refreshed")
                except OSError as error:
                    shutil.rmtree(fresh, ignore_errors=True)
                    fail(f"could not refresh copied skill {real}: {error}")


def swap(fresh, target):
    """Rename fresh into target's place, restoring target on failure. Returns the old copy."""
    old = target.with_name(f".{target.name}.srulik-before")
    if old.exists():
        raise OSError(f"{old} is left from an interrupted run")
    os.replace(target, old)
    try:
        os.replace(fresh, target)
    except OSError:
        os.replace(old, target)
        raise
    return old


def sync_cursor(plugin, check):
    """Cursor has no plugin updater: replace its local copy (CONTRIBUTING.md)."""
    copy = Path.home() / ".cursor" / "plugins" / "local" / "srulik-toolkit"
    if not copy.is_dir():
        return
    if plugin is None:
        fail(f"cursor copy {copy} not checked: no Claude Code or Codex source here")
        return
    if not differing_files(plugin, copy) and not differing_files(copy, plugin):
        say(f"cursor: {copy} matches the source; reload Cursor windows if needed")
        return
    if check:
        fail(f"cursor copy {copy} differs from the source")
        return
    fresh = copy.with_name(".srulik-toolkit.update")
    try:
        shutil.rmtree(fresh, ignore_errors=True)
        shutil.copytree(plugin, fresh)
        old = swap(fresh, copy)
    except OSError as error:
        shutil.rmtree(fresh, ignore_errors=True)
        return fail(f"could not replace cursor copy {copy}: {error}")
    backup = Path(tempfile.mkdtemp(prefix="srulik-cursor-before-")) / "srulik-toolkit"
    shutil.move(str(old), str(backup))
    say(f"cursor: replaced {copy} (previous copy at {backup}); reload Cursor windows to load it")


def update_here(check):
    cache_roots, later = {}, []
    plugin = update_claude(check, cache_roots, later)
    plugin = update_codex(check, cache_roots) or plugin
    home = Path.home()
    claude_home = Path(os.environ.get("CLAUDE_CONFIG_DIR") or home / ".claude")
    codex_home = Path(os.environ.get("CODEX_HOME") or home / ".codex")
    folders = [claude_home / "skills", home / ".agents" / "skills", codex_home / "skills", home / ".cursor" / "skills"]
    repoint_aliases(folders, cache_roots, check)
    if plugin:
        refresh_copies(folders, plugin, cache_roots, check)
    sync_cursor(plugin, check)
    for verify in later:  # after the repairs, since Claude may list an alias
        verify()


def main():
    sys.stdout.reconfigure(errors="replace")
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--check", action="store_true", help="verify only and change nothing")
    parser.add_argument("--via", action="append", default=[], metavar="COMMAND",
                        help='also run through a command that starts Python elsewhere, e.g. "ssh my-pc python"')
    args = parser.parse_args()
    say(f"== {getpass.getuser()}@{platform.node()}" + (" (check only)" if args.check else ""))
    try:
        update_here(args.check)
    except Exception as error:  # report, then reach the other targets
        fail(f"{type(error).__name__}: {error}")
    results = [("this account", not problems)]
    for command in args.via:
        say(f"\n== via {command}")
        rerun = subprocess.run(shlex.split(command) + ["-"] + (["--check"] if args.check else []),
                               input=Path(__file__).read_bytes())
        results.append((command, rerun.returncode == 0))
    say("\n" + "\n".join(f"{'ok    ' if ok else 'FAILED'} {name}" for name, ok in results))
    sys.exit(0 if all(ok for _, ok in results) else 1)


if __name__ == "__main__":
    main()
