# Oh My Pi mapping

Oh My Pi (OMP) runs on T3 Code as an ACP provider and in its own terminal.
Observed with OMP 18.16.0 and Kimi K3.1 Pro on T3 Code, 2026-11-06.

Load skills with `read("skill://<name>")`, for example `skill://create-plan`
and `skill://implement-plan`. Verify the resolved path: OMP reads the plugin
directory named in its profile's `extensions` list, which can lag the checkout.
A skill with `disable-model-invocation: true` is hidden from OMP's catalog but
still resolves through `skill://`.

Ask with `ask`. Required answers and implementation authority remain pending
until actually received.

On T3 Code, reach T3 tools through `xd://mcp__t3_code_<tool>` and follow the
[T3 Code mapping](t3-code.md) for children, rounds and HTML presentation. An
unprefixed `xd://<tool>` returns `No such tool`. In the OMP terminal, `task`
launches local children.

Isolated testing of an uninstalled revision through a disposable profile
(`omp --profile <name>`) or a `--config` overlay whose `extensions` entry names
the checkout's plugin directory is unverified. Never edit a shared profile to
test. Record the OMP version, model and observed evidence; leave other
configurations unverified.
