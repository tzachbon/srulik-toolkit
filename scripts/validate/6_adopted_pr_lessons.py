# Lessons adopted from tstack: lease-only force pushes, scope-holding reviews,
# old-PR triage, labelled comments, unattended proof, and T3 watch caveats.
pr_comments = (skill_root / "pr-babysit" / "references" / "comments.md").read_text(encoding="utf-8")
create_pr_core = (skill_root / "create-pr" / "SKILL.md").read_text(encoding="utf-8")
create_pr_prep = (skill_root / "create-pr" / "references" / "preparation.md").read_text(encoding="utf-8")
create_pr_publish = (skill_root / "create-pr" / "references" / "publishing.md").read_text(encoding="utf-8")
review_pro_max = (skill_root / "review-pro-max" / "SKILL.md").read_text(encoding="utf-8")
conflicts = (skill_root / "resolving-merge-conflicts" / "SKILL.md").read_text(encoding="utf-8")
tstack_contracts = {
    "pr-babysit": (pr_babysit, [
        "rebasing that branch onto its base with a lease-protected force push",
        "Never force-push without a lease or to any other branch",
        "push with `--force-with-lease=<head ref>:<recorded sha>`",
        "integrate every remote commit the local branch lacks",
        "it does not keep commits the local branch never had",
        "if the lease fails, fetch and integrate again instead of overwriting",
        "compare the old and new commit series with `git range-diff`",
        "Keep the PR at the size its goal needs",
        "is a nit whatever its label, unless evidence shows",
        "decline a nit with a written reason and list it as a follow-up",
        "Prefer the fix that deletes or narrows code",
        "[comment rules](references/comments.md)",
        "## Old or inherited PRs",
        "- **Modernize:**", "- **Rework:**", "- **Close:**",
        "Never close a PR without the user's request",
        "Keep their Git authorship and co-author trailers",
        "model attribution does not replace contributor credit",
        "never wait for their run or hold readiness for them",
        "[GitHub](references/github.md)",
        "Without merge authority, report `READY` and keep listening",
        "Report `CLOSED` only after the provider reports the PR merged",
        "unless evidence shows the changed flow or a supported caller reaches it",
        "base commits that landed after the last green run touch this PR's files",
        "never with an administrator bypass",
    ]),
    "pr-babysit comments": (pr_comments, [
        "> 🤖 **<model> responding on behalf of <user>**",
        "If it reports none, use the harness name. Do not guess",
        "for secrets and private details",
        "Resolve a thread only after its reply posted",
    ]),
    "pr-babysit T3": (pr_babysit_t3, [
        "reports conflicts but not a branch that fell behind its base",
        "Never re-watch in a tight loop",
        "gh api --hostname <host> rate_limit",
    ]),
    "end-to-end": (end_to_end, [
        "## Unattended work",
        "a question in an ordinary message looks like finished work",
        "Ask through the host's question capability so the conversation shows it is waiting",
        "leave the PR unmerged and start the handoff with the question",
        "## Proof",
        "Proof is evidence you observed in this session",
        "green mocked tests do not prove the user experience",
        "even when a project instruction says to ask first or to leave testing to the user",
        "Instructions about how to test still apply",
        "It does not authorize production changes, data deletion, or bypassing a host approval prompt",
        "Force-push only this task's branch. Before rewriting it, fetch and integrate every remote commit it lacks",
        "Proof must cover every change in the final diff",
    ]),
    "end-to-end T3": (end_to_end_t3, [
        "A watched thread stays in Working and out of the user's inbox",
        "call `unwatch_pull_request`, then ask with the harness's question tool",
        "reports conflicts but not a branch that fell behind its base",
    ]),
    "create-pr": (create_pr_core, ["rebasing the change's own branch with a lease-protected force push", "Never force-push without a lease or to another branch"]),
    "create-pr preparation": (create_pr_prep, ["after committing, as publication describes, not on a dirty worktree", "rewrite commits this change does not own", "Never rewrite a branch other people push to"]),
    "create-pr publishing": (create_pr_publish, ["Never force-push any other branch", "create through REST, which has a separate quota", "`--force-with-lease=<branch>:<that sha>`", "integrate them first", "or merge it when the repository prefers merge commits", "on the resulting state", "-F draft=<true|false>", "gh api --hostname <host> repos/"]),
    "pr-babysit GitHub": ((skill_root / "pr-babysit" / "references" / "github.md").read_text(encoding="utf-8"), ["--hostname <host>", "CodeRabbit is advisory", "REST has a separate quota", "legacy combined status", "cannot be read, report that as a blocker instead of `READY`"]),
    "create-pr conventions": (pr_conventions, ["Open the body with the problem in the user's terms", "`Created with <model> in <harness>.`"]),
    "review-pro-max": (review_pro_max, ["Prefer reviewers on models from a different provider than the author", "report an unavailable one instead of substituting", "is low unless evidence shows the intended case hits it"]),
    "implement-plan scope": (" ".join(implement_plan.split()), ["unless evidence shows the changed flow or a supported caller reaches them", "If a round grew the diff, cut first", "Do not agree with a finding just to end the loop", "stays disputed after two replies, stop and show both sides"]),
    "resolving-merge-conflicts": (conflicts, ["needs a force push with a lease, which only that caller's authority allows"]),
}
for surface_name, (surface, phrases) in tstack_contracts.items():
    for phrase in phrases:
        if phrase not in surface:
            raise SystemExit(f"{surface_name} is missing adopted contract: {phrase}")
for surface_name, surface in [("pr-babysit", pr_babysit), ("end-to-end", end_to_end), ("create-pr", create_pr_core + create_pr_publish)]:
    for retired in ["Do not rebase a published PR head", "fetch and reassess instead of overwriting", "Never force-push or rewrite published history", "Never force-push, bypass checks", "a normal push, and pull request creation"]:
        if retired in surface:
            raise SystemExit(f"{surface_name} still forbids lease-protected rebases: {retired}")
if re.search(r"AskUserQuestion|request_user_input|\bSol\b|gh api|GraphQL|CodeRabbit", end_to_end + pr_babysit):
    raise SystemExit("question tools and model names belong in host references, not skill cores")
