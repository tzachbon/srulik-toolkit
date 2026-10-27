# pr-babysit on GitHub

Provider details for the [Readiness](../SKILL.md#readiness) rules. Pass the PR's host to every `gh api` call with `--hostname <host>`, because `gh` otherwise uses its configured default host.

- **Advisory bots.** CodeRabbit is advisory: treat its findings like any other, but never wait for its run or hold readiness for it.
- **GraphQL quota.** `gh pr view`, `gh pr checks`, and `gh pr create` use GraphQL. REST has a separate quota and usually still has room. Read the PR with `gh api --hostname <host> repos/<owner>/<repo>/pulls/<number>` and checks with `gh api --hostname <host> repos/<owner>/<repo>/commits/<sha>/check-runs`. Check remaining quota with `gh api --hostname <host> rate_limit --jq .resources.graphql`.
