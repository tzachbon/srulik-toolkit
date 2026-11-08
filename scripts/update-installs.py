#!/usr/bin/env python3
"""Update every Srulik Toolkit install this account has, then verify what actually loads.

Usage: update-installs.py [--check] [--via COMMAND ...]

--check verifies without changing anything. --via runs this script through a command that
starts Python elsewhere, e.g. "ssh my-pc python" or "sudo -n -u other-user -H python3".
Exits 1 when any update or check fails. README "Every installation at once" has details.
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
    """The plugin folder, version and {skill: description} that a marketplace checkout provides."""
    plugin = Path(marketplace_root) / "plugins" / "srulik-toolkit"
    skills = {}
    for skill in sorted(plugin.glob("skills/*/SKILL.md")):
        match = re.search(r"^description:[ \t]*(.*)$", skill.read_text(encoding="utf-8"), re.M)
        skills[skill.parent.name] = match.group(1).strip() if match else ""
    return plugin, (plugin / "VERSION").read_text(encoding="utf-8").strip(), skills


def differing_files(source, installed):
    """Source files missing from installed or different there. Line endings are ignored, since
    Git on Windows may check the source out with CRLF."""
    # ponytail: CRLF folding also applies to binary files; a false match needs a binary that differs only there.
    differing = []
    for file in sorted(source.rglob("*")):
        if file.is_file():
            relative = file.relative_to(source)
            copy = installed / relative
            if not copy.is_file() or copy.read_bytes().replace(b"\r\n", b"\n") != file.read_bytes().replace(b"\r\n", b"\n"):
                differing.append(relative.as_posix())
    return differing


def missing_skills(found, skills, shown):
    """Skills a fresh process does not show with the current description, under the toolkit name or a
    short alias. Claude lists a symlinked alias instead of the toolkit name when both are one folder."""
    descriptions = {re.sub(r" \((user|project)\)$", "", text) for text in found.values()}  # Claude tags an alias's scope
    return [name for name, description in skills.items()
            if found.get(PREFIX + name) != shown(description) and description not in descriptions]


def toml_section(text, header):
    """The body of one [header] table. Enough for the flat tables this script reads."""
    # ponytail: not a TOML parser (Python 3.10 and older have none); reads plain key = "value" lines only.
    match = re.search(r"^\[" + re.escape(header) + r"\][ \t]*$(.*?)(?=^\[|\Z)", text, re.M | re.S)
    return match.group(1) if match else None


def toml_value(section, key):
    match = re.search(r"^" + key + r"\s*=\s*[\"']([^\"']*)[\"']", section or "", re.M)
    return match.group(1) if match else None


def report_installed(name, installed, version, plugin, want):
    if installed.name != want:
        fail(f"{name} installed {installed.name}, source has {want}")
    differing = differing_files(plugin, installed)
    if differing:
        fail(f"{name} install {installed} differs from source in {len(differing)} files, e.g. {differing[:3]}")


def describe_source(root):
    head = run(["git", "-C", str(root), "rev-parse", "--short", "HEAD"]) if shutil.which("git") else None
    return f"{root} @ {head.stdout.strip()}" if head and head.returncode == 0 else str(root)


def claude_commands(exe, cwd):
    """Commands a fresh Claude process discovers in cwd. The initialize handshake runs no model turn."""
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
        say(f"  note: {len(stale)} project records still list an older version after the native update; "
            "the discovery check below only tells versions apart where a skill description changed")
    if user and not user.get("enabled", True):
        say("  note: disabled for this account, discovery not checked")
        return plugin
    home = [None] if user else []  # a project-only install correctly does not load in the home folder
    later.append(lambda: verify_claude(exe, home + [Path(entry["projectPath"]) for entry in live], skills))
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
        for line in process.stdout:  # app-server quits on end of input, so stdin stays open until the answer
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
        say("codex: srulik-toolkit is disabled for this account, skipped")
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
    caches = {Path(CACHE_LINK.match(skill["path"]).group(1) + CACHE_LINK.match(skill["path"]).group(2)) for skill in ours}
    if len(caches) != 1:
        fail(f"codex loads toolkit skills from {len(caches)} installs: {sorted(map(str, caches))}")
        return plugin
    installed = caches.pop()
    report_installed("codex", installed, version, plugin, version)
    cache_roots[CACHE_LINK.match(str(installed / "skills" / "x")).group(1)] = installed.name
    missing = missing_skills({skill["name"]: skill.get("description", "") for skill in ours}, skills, lambda description: description)
    if missing:
        fail(f"codex does not load the current {missing[:5]}")
    say(f"  checked files and discovery of {len(skills)} skills")
    return plugin


def repoint_aliases(folders, cache_roots, check):
    """Move symlinked skill aliases that point into an older toolkit cache to the installed version."""
    # ponytail: symlinks only. Copied aliases and Windows junctions are left alone; add them if one turns up.
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
                except PermissionError:  # Windows does not replace a directory symlink in place
                    os.unlink(link)
                    os.replace(temporary, link)
                say(f"  alias {link} now points at {target}")


def skill_differs(source, copy):
    """Whether a copied skill differs from source, ignoring its SKILL.md name line, which a copy may rename."""
    for file in source.rglob("*"):
        if not file.is_file():
            continue
        other = copy / file.relative_to(source)
        if not other.is_file():
            return True
        a, b = (path.read_bytes().replace(b"\r\n", b"\n") for path in (file, other))
        if file.name == "SKILL.md":
            a, b = (re.sub(rb"^name:.*$", b"", text, count=1, flags=re.M) for text in (a, b))
        if a != b:
            return True
    return False


def refresh_copies(folders, plugin, cache_roots, check):
    """Refresh plain copies of toolkit skills that match some installed version, keeping each copy's name line."""
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
            except OSError as error:  # e.g. a Windows junction this session may not follow
                say(f"  note: skipped {skill}: {error}")
                continue
            seen.add(real)
            if not any((old / "skills" / skill.name).is_dir() and not skill_differs(old / "skills" / skill.name, real) for old in versions):
                say(f"  note: {skill} matches no installed toolkit version, left as is")
            elif check:
                fail(f"copied skill {skill} is out of date")
            elif not os.access(real, os.W_OK):
                say(f"  note: copied skill {real} is out of date and not writable here; run as its owner to refresh it")
            else:
                name = re.search(r"^name:.*$", (real / "SKILL.md").read_text(encoding="utf-8"), re.M)
                try:
                    for file in source.rglob("*"):
                        if file.is_file():
                            target = real / file.relative_to(source)
                            target.parent.mkdir(parents=True, exist_ok=True)
                            text = file.read_bytes()
                            if file.name == "SKILL.md" and name:
                                text = re.sub(rb"^name:.*$", name.group(0).encode("utf-8"), text, count=1, flags=re.M)
                            temporary = target.with_name("." + target.name + ".srulik-update")
                            temporary.write_bytes(text)
                            shutil.copymode(file, temporary)  # keeps scripts such as build.sh executable
                            os.replace(temporary, target)
                    say(f"  copied skill {real} refreshed")
                except OSError as error:
                    fail(f"could not refresh copied skill {real}: {error}; rerun as its owner")


def sync_cursor(plugin, check):
    """Cursor has no plugin updater: replace its local copy, as CONTRIBUTING.md describes."""
    copy = Path.home() / ".cursor" / "plugins" / "local" / "srulik-toolkit"
    if not copy.is_dir():
        return
    if plugin is None:
        fail(f"cursor copy {copy} not checked: no Claude Code or Codex install here to take the source from")
        return
    if not differing_files(plugin, copy):
        say(f"cursor: {copy} matches the source; reload Cursor windows to load it")
        return
    if check:
        fail(f"cursor copy {copy} differs from the source")
        return
    fresh = copy.with_name(".srulik-toolkit.update")
    shutil.rmtree(fresh, ignore_errors=True)
    shutil.copytree(plugin, fresh)
    backup = Path(tempfile.mkdtemp(prefix="srulik-cursor-before-")) / "srulik-toolkit"
    shutil.move(str(copy), str(backup))
    os.replace(fresh, copy)
    say(f"cursor: replaced {copy} (previous copy kept at {backup}); reload Cursor windows to load it")


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
    for verify in later:  # Claude may list an alias instead of the toolkit skill, so check after the repairs
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
    except Exception as error:  # report and still reach the other targets
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
