# scripts/update-installs.py against local fakes: no real claude or codex, no network.
update_script = root / "scripts" / "update-installs.py"
update_text = update_script.read_text(encoding="utf-8")
for update_phrase in ['"plugin", "marketplace", "update", MARKETPLACE', '"plugin", "update", PLUGIN, "--scope"',
                      '"plugin", "marketplace", "upgrade", MARKETPLACE', '"plugin", "add", PLUGIN',
                      '"subtype": "initialize"', '"forceReload": True']:
    if update_phrase not in update_text:
        raise SystemExit(f"update-installs.py no longer runs the native step: {update_phrase}")
if "update-installs.py" not in readme:
    raise SystemExit("README must describe scripts/update-installs.py")

import importlib.util
import types
update_spec = importlib.util.spec_from_file_location("update_installs", update_script)
update_module = importlib.util.module_from_spec(update_spec)
update_spec.loader.exec_module(update_module)

with tempfile.TemporaryDirectory() as update_tmp:
    update_tmp = pathlib.Path(update_tmp)

    def update_skill(base, name, description, skill_name=None):
        (base / name).mkdir(parents=True, exist_ok=True)
        (base / name / "SKILL.md").write_text(f"---\nname: {skill_name or name}\ndescription: {description}\n---\nbody {description}\n", encoding="utf-8", newline="\n")

    update_source = update_tmp / "source" / "plugins" / "srulik-toolkit"
    update_skill(update_source / "skills", "alpha", "new alpha")
    update_skill(update_source / "skills", "beta", "new beta")
    (update_source / "skills" / "alpha" / "run.sh").write_text("#!/bin/sh\n", encoding="utf-8")
    os.chmod(update_source / "skills" / "alpha" / "run.sh", 0o755)
    (update_source / "VERSION").write_text("2.0.0\n", encoding="utf-8")
    plugin_path, update_version, update_skills = update_module.expected(update_tmp / "source")
    if update_version != "2.0.0" or update_skills != {"alpha": "new alpha", "beta": "new beta"}:
        raise SystemExit("update-installs.py misreads the source skills")

    update_copy = update_tmp / "copy"
    shutil.copytree(update_source, update_copy)
    (update_copy / "skills" / "beta" / "SKILL.md").write_bytes((update_source / "skills" / "beta" / "SKILL.md").read_bytes().replace(b"\n", b"\r\n"))
    if update_module.differing_files(update_source, update_copy):
        raise SystemExit("update-installs.py must ignore CRLF checkouts")
    for update_extra in (".in_use/42", ".orphaned_at", "skills/alpha/__pycache__/x.pyc"):
        (update_copy / update_extra).parent.mkdir(parents=True, exist_ok=True)
        (update_copy / update_extra).write_text("runtime", encoding="utf-8")
    update_module.problems.clear()
    update_module.report_installed("test", update_copy, "2.0.0", update_source, "copy")
    if update_module.problems:
        raise SystemExit(f"update-installs.py must ignore files Claude or Python add to a cache: {update_module.problems}")
    update_skill(update_copy / "skills", "retired", "dropped by the source")
    update_module.report_installed("test", update_copy, "2.0.0", update_source, "copy")
    if len(update_module.problems) != 1 or "retired" not in update_module.problems[0]:
        raise SystemExit(f"update-installs.py must report an install with a skill the source dropped: {update_module.problems}")
    update_module.problems.clear()
    shutil.rmtree(update_copy / "skills" / "retired")
    (update_copy / "skills" / "alpha" / "SKILL.md").write_text("changed", encoding="utf-8")
    if update_module.differing_files(update_source, update_copy) != ["skills/alpha/SKILL.md"]:
        raise SystemExit("update-installs.py missed a changed installed file")

    claude_label = lambda description: "(srulik-toolkit) " + description
    if update_module.missing_skills({"srulik-toolkit:alpha": "(srulik-toolkit) new alpha", "srulik-toolkit:beta": "(srulik-toolkit) old beta"},
                                    update_skills, claude_label) != ["beta"]:
        raise SystemExit("update-installs.py must flag a skill discovered with another version's description")
    if update_module.missing_skills({"srulik-toolkit:alpha": "(srulik-toolkit) new alpha", "beta": "new beta (user)"}, update_skills, claude_label):
        raise SystemExit("update-installs.py must accept a current skill that Claude lists under its alias")
    if update_module.missing_skills({"srulik-toolkit:alpha": "(srulik-toolkit) new alpha", "beta": "old beta (user)"}, update_skills, claude_label) != ["beta"]:
        raise SystemExit("update-installs.py must flag an alias that loads another version")

    update_config = 'model = "x"\n[marketplaces.srulik-toolkit]\nsource_type = "git"\nsource = "https://example.invalid/r.git"\n\n[plugins."srulik-toolkit@srulik-toolkit"]\nenabled = true\n'
    update_market = update_module.toml_section(update_config, "marketplaces.srulik-toolkit")
    if update_module.toml_value(update_market, "source_type") != "git" or update_module.toml_value(update_market, "source") != "https://example.invalid/r.git":
        raise SystemExit("update-installs.py misreads the Codex marketplace table")
    for update_line, update_path in [('source = "/home/O\'Connor/t"', "/home/O'Connor/t"), ('source = "C:\\\\a\\\\b"', "C:\\a\\b"), ("source = 'C:\\a\\b'", "C:\\a\\b")]:
        if update_module.toml_value(update_line, "source") != update_path:
            raise SystemExit(f"update-installs.py misreads the TOML string {update_line}")
    if "enabled = true" not in update_module.toml_section(update_config, 'plugins."srulik-toolkit@srulik-toolkit"'):
        raise SystemExit("update-installs.py misreads the Codex plugin table")

    update_cache = update_tmp / "home" / ".claude" / "plugins" / "cache" / "srulik-toolkit" / "srulik-toolkit"
    for update_cache_version, update_word in [("1.0.0", "old"), ("2.0.0", "new")]:
        update_skill(update_cache / update_cache_version / "skills", "alpha", f"{update_word} alpha")
        update_skill(update_cache / update_cache_version / "skills", "beta", f"{update_word} beta")
    update_roots = {str(update_cache) + os.sep: "2.0.0"}
    update_aliases = update_tmp / "home" / ".claude" / "skills"
    update_aliases.mkdir(parents=True)
    update_copies = update_tmp / "home" / ".agents" / "skills"
    update_skill(update_copies, "alpha", "old alpha", "srulik-toolkit:alpha")
    for update_base, update_word in [(update_source / "skills" / "alpha", "new"), (update_cache / "1.0.0" / "skills" / "alpha", "old"), (update_copies / "alpha", "old")]:
        update_skill(update_base / "bundled", "inner", f"{update_word} inner")
    update_skill(update_copies, "beta", "my own beta")
    for update_base in (update_cache / "1.0.0" / "skills" / "alpha", update_copies / "alpha"):
        (update_base / "dropped.txt").write_text("dropped by 2.0.0\n", encoding="utf-8", newline="\n")
    update_skill(update_source / "skills", "gamma", "new gamma")
    (update_source / "skills" / "gamma" / "run.sh").write_text("released\n", encoding="utf-8", newline="\n")
    update_skill(update_cache / "1.0.0" / "skills", "gamma", "old gamma")
    update_skill(update_copies, "gamma", "old gamma")
    (update_copies / "gamma" / "run.sh").write_text("my own script\n", encoding="utf-8", newline="\n")
    update_folders = [update_aliases, update_copies]
    can_link = True
    try:
        os.symlink(update_cache / "1.0.0" / "skills" / "alpha", update_aliases / "alpha", target_is_directory=True)
    except OSError:
        can_link = False  # Windows without symlink rights
    update_module.problems.clear()
    update_module.repoint_aliases(update_folders, update_roots, True)
    update_module.refresh_copies(update_folders, plugin_path, update_roots, True)
    if len(update_module.problems) != 1 + can_link:
        raise SystemExit(f"update-installs.py --check must report each stale alias and copy: {update_module.problems}")
    update_module.problems.clear()
    update_access, os.access = os.access, lambda *args, **options: False
    try:
        update_module.refresh_copies(update_folders, plugin_path, update_roots, False)
    finally:
        os.access = update_access
    if len(update_module.problems) != 1 or "not writable" not in update_module.problems[0]:
        raise SystemExit(f"update-installs.py must fail on an outdated copy it cannot write: {update_module.problems}")
    update_module.problems.clear()
    update_copytree, shutil.copytree = shutil.copytree, lambda *args, **options: (_ for _ in ()).throw(OSError("disk full"))
    try:
        update_module.refresh_copies(update_folders, plugin_path, update_roots, False)
    finally:
        shutil.copytree = update_copytree
    if len(update_module.problems) != 1 or "old alpha" not in (update_copies / "alpha" / "SKILL.md").read_text(encoding="utf-8"):
        raise SystemExit(f"update-installs.py must fail a broken refresh and keep the old copy whole: {update_module.problems}")
    if sorted(path.name for path in update_copies.iterdir()) != ["alpha", "beta", "gamma"]:
        raise SystemExit("update-installs.py must clean up after a broken refresh")
    update_module.problems.clear()
    update_module.repoint_aliases(update_folders, update_roots, False)
    update_module.refresh_copies(update_folders, plugin_path, update_roots, False)
    if update_module.problems:
        raise SystemExit(f"update-installs.py failed on fake installs: {update_module.problems}")
    if can_link and pathlib.Path(update_module.link_target(update_aliases / "alpha")) != update_cache / "2.0.0" / "skills" / "alpha":
        raise SystemExit("update-installs.py did not repoint a stale alias")
    update_refreshed = (update_copies / "alpha" / "SKILL.md").read_text(encoding="utf-8")
    if "name: srulik-toolkit:alpha" not in update_refreshed or "new alpha" not in update_refreshed:
        raise SystemExit("update-installs.py must refresh a copied skill and keep its name line")
    if "name: inner" not in (update_copies / "alpha" / "bundled" / "inner" / "SKILL.md").read_text(encoding="utf-8"):
        raise SystemExit("update-installs.py must keep a bundled skill's own name")
    if "my own beta" not in (update_copies / "beta" / "SKILL.md").read_text(encoding="utf-8"):
        raise SystemExit("update-installs.py must leave a customized copy alone")
    if (update_copies / "alpha" / "dropped.txt").exists() or update_module.skill_differs(update_source / "skills" / "alpha", update_copies / "alpha"):
        raise SystemExit("update-installs.py must leave a refreshed copy identical to the source")
    if (update_copies / "gamma" / "run.sh").read_text(encoding="utf-8") != "my own script\n":
        raise SystemExit("update-installs.py must leave a copy with an added file alone")
    if os.name != "nt" and not os.stat(update_copies / "alpha" / "run.sh").st_mode & 0o100:
        raise SystemExit("update-installs.py must keep a refreshed script executable")
    update_inner = update_copies / "alpha" / "bundled" / "inner" / "SKILL.md"
    update_inner.write_text(update_inner.read_text(encoding="utf-8").replace("name: inner", "name: alpha"), encoding="utf-8", newline="\n")
    if not update_module.skill_differs(update_source / "skills" / "alpha", update_copies / "alpha"):
        raise SystemExit("update-installs.py must treat a renamed bundled skill as a difference")

    update_saved = {name: getattr(update_module, name) for name in ("update_claude", "update_codex", "repoint_aliases", "sync_cursor")}
    update_order = []
    update_module.update_claude = lambda check, roots, later: later.append(lambda: update_order.append("verify"))
    update_module.update_codex = lambda check, roots: None
    update_module.repoint_aliases = lambda *args: update_order.append("repair")
    update_module.sync_cursor = lambda *args: None
    try:
        update_module.update_here(False)
    finally:
        for update_name, update_value in update_saved.items():
            setattr(update_module, update_name, update_value)
    if update_order != ["repair", "verify"]:
        raise SystemExit(f"update-installs.py must check Claude discovery after repairing aliases: {update_order}")

    update_project = update_tmp / "project"
    update_project.mkdir()
    update_answers = {"marketplace": json.dumps([{"name": "srulik-toolkit", "installLocation": str(update_tmp / "source")}]),
                      "plugin": json.dumps([{"id": update_module.PLUGIN, "scope": "project", "projectPath": str(update_project),
                                             "installPath": str(update_cache / "2.0.0"), "version": "2.0.0"}])}
    update_saved = (update_module.run, update_module.verify_claude, shutil.which)
    update_places, update_later = [], []
    update_module.run = lambda args, *rest, **options: types.SimpleNamespace(returncode=0 if "list" in args else 1, stderr="",
                                                                            stdout=update_answers["marketplace" if "marketplace" in args else "plugin"])
    update_module.verify_claude = lambda exe, places, skills: update_places.extend(places)
    shutil.which = lambda name: name
    try:
        update_module.update_claude(True, {}, update_later)
        [verify() for verify in update_later]
    finally:
        update_module.run, update_module.verify_claude, shutil.which = update_saved
    if update_places != [update_project]:
        raise SystemExit(f"update-installs.py must check a project-only Claude install in its project, not home: {update_places}")

    update_env = {key: os.environ.get(key) for key in ("HOME", "USERPROFILE")}
    os.environ["HOME"] = os.environ["USERPROFILE"] = str(update_tmp / "home")
    update_cursor = update_tmp / "home" / ".cursor" / "plugins" / "local" / "srulik-toolkit"
    shutil.copytree(update_source, update_cursor)
    update_skill(update_cursor / "skills", "retired", "dropped by the source")
    update_module.problems.clear()
    try:
        update_module.sync_cursor(None, True)
        if len(update_module.problems) != 1:
            raise SystemExit("update-installs.py must report a Cursor copy it cannot check")
        update_module.problems.clear()
        update_module.sync_cursor(update_source, True)
        if len(update_module.problems) != 1:
            raise SystemExit("update-installs.py must report a Cursor copy with a skill the source dropped")
        update_module.problems.clear()
        tempfile.tempdir = str(update_tmp)  # keep the Cursor backup inside this test folder
        update_module.sync_cursor(update_source, False)
        if (update_cursor / "skills" / "retired").exists() or update_module.problems:
            raise SystemExit("update-installs.py must replace a Cursor copy with a skill the source dropped")
    finally:
        tempfile.tempdir = None
        for update_name, update_value in update_env.items():
            if update_value is None:
                os.environ.pop(update_name, None)
            else:
                os.environ[update_name] = update_value
print("update-installs passed")
