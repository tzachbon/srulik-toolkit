# Running inside a container

Agents running inside a container, such as an OpenClaw gateway, see only the container's filesystem and network.

- **Skill files.** Install a copy of this skill directory inside a mounted path the agent reads skills from. A symlink to a host path outside the container's mounts does not resolve.
- **Adapter.** The host's loopback desktop relay is not reachable from a bridged container. Reuse the container's existing, approved route to the PC, if it has one, as the `--windows-exec` command. Without one, the Windows capability is unavailable there: say so and stop. Do not add a new network bridge or credentials for this skill.
- **Cloud fallback.** The host's `depot-workspace` command and its credentials are not inside the container, so use `--fallback none`.
- **Verification.** Run `node <skill>/scripts/remote-playwright.mjs check` inside the container, then one harmless adapter call (`Write-Output ok`) when an adapter exists. Report each backend as working or unavailable, with the reason.
