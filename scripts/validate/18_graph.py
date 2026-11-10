# agent-swarm graph mode: skill text contracts, host boundary, attribution, no dependencies, then the
# behavioral contract test (scripts/test-graph.js) against local fakes.
graph_skill = (skill_root / "agent-swarm" / "SKILL.md").read_text(encoding="utf-8")
graph_spec_ref = (skill_root / "agent-swarm" / "references" / "graph-spec.md").read_text(encoding="utf-8")
graph_t3_ref = (skill_root / "agent-swarm" / "references" / "t3-code.md").read_text(encoding="utf-8")
graph_notice = (root / "NOTICE.md").read_text(encoding="utf-8")
graph_standards = (root / "CODING_STANDARDS.md").read_text(encoding="utf-8")

for graph_phrase in ["## Graph mode", "retry once with the failure reason", "Stop only when nothing more can run",
                     "applied automatically", "opinion about a model", "on one fixed port", "references/graph-spec.md"]:
    if graph_phrase not in graph_skill:
        raise SystemExit(f"agent-swarm graph mode must say: {graph_phrase}")
graph_core = graph_skill.split("## Graph mode", 1)[1].split("\n## ", 1)[0]
for graph_host_name in ["delegate_task", "orchestrator_capabilities", "schedule_task", "preview_open", "sudo"]:
    if graph_host_name in graph_core:
        raise SystemExit(f"agent-swarm graph mode core must not name host tool: {graph_host_name}")
for graph_phrase in ["| ui-ux | arena.webdev", "30-day half-life", "whole population", "`partial`"]:
    if graph_phrase not in graph_spec_ref:
        raise SystemExit(f"graph-spec reference must document: {graph_phrase}")
for graph_phrase in ["delegate_task", "orchestrator_capabilities", "schedule_task", "sudo -n aa-models usage", "preview_open"]:
    if graph_phrase not in graph_t3_ref:
        raise SystemExit(f"agent-swarm T3 reference must map: {graph_phrase}")
for graph_phrase in ["outlives the turn", "at most one view server", "--port 47812", "Never use `0.0.0.0` or a public address", '{kind: "environment-port", port}', "never change or restart the T3 server"]:
    if graph_phrase not in graph_t3_ref:
        raise SystemExit(f"agent-swarm T3 reference must keep the live page open: {graph_phrase}")
e2e_skill = (skill_root / "execute-task-end-to-end" / "SKILL.md").read_text(encoding="utf-8")
e2e_t3_ref = (skill_root / "execute-task-end-to-end" / "references" / "t3-code.md").read_text(encoding="utf-8")
for graph_phrase in ["graphs/pr-review.yaml", "after each push that fixes review findings", "confirms nothing new", "no finding was `cap-skipped`", "already decided",
                     "like a bot finding"]:
    if graph_phrase not in e2e_skill:
        raise SystemExit(f"execute-task-end-to-end must run the pr-review graph: {graph_phrase}")
if "../../agent-swarm/references/t3-code.md" not in e2e_t3_ref:
    raise SystemExit("execute-task-end-to-end T3 mapping must point at agent-swarm's graph mapping")
if "LMArena" not in graph_notice or "CC-BY-4.0" not in graph_notice:
    raise SystemExit("NOTICE must attribute the LMArena dataset and its CC-BY-4.0 license")
if "Durable graph state" not in graph_standards or "~/.srulik-toolkit" not in graph_standards:
    raise SystemExit("CODING_STANDARDS must record the durable graph-state exception")
if list(plugin.rglob("package.json")) or list(plugin.rglob("node_modules")):
    raise SystemExit("graph mode must use only the Node.js standard library")
if (root / "scripts" / "validate" / "18_graph.py").stat().st_size >= 20 * 1024:
    raise SystemExit("18_graph.py must stay under 20 KB")

subprocess.run([node, str(plugin / "scripts" / "graph.js"), "check",
                str(skill_root / "agent-swarm" / "graphs" / "pr-review.yaml")], check=True, timeout=30, stdout=subprocess.DEVNULL)
subprocess.run([node, str(root / "scripts" / "test-graph.js")], check=True, timeout=120, stdout=subprocess.DEVNULL)  # also loads test-graph-run.js, test-graph-models.js and test-graph-review.js
