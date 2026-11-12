# Graph live view

Part of the [graph spec](graph-spec.md).

`graph.js view <run-dir> [--port N] [--host <address>]` serves a page that replays `run.jsonl` and streams new events. By default it listens on the machine's Tailscale IPv4 address (a `100.64/10` address on a `tailscale*` or `utun*` interface), so its link works from the owner's other devices, and on `127.0.0.1` when there is none. `--host` overrides it with one literal loopback or private address: `10/8`, `172.16/12`, `192.168/16`, Tailscale's `100.64/10`, or IPv6 `::1` or `fc00::/7`. Host names, public addresses and every spelling of `0.0.0.0` or `::` are refused, because the page has no login. It listens only on that address, not also on loopback. Requests whose `Host` header names any other address get 403, so a page on another site can't reach it through DNS rebinding.


The page draws the run as a node graph: one card per instance, with its item, a status word, the model and effort, the duration, its summary or error, and its attachments. Edges run from each instance's source; an instance that didn't fan out from one source gets an edge from every instance of each node it depends on. The graph is top-down by default, with a left-to-right toggle. The theme follows the system until the owner picks one with the theme button; both choices are kept in the browser. A header shows the graph name, its inputs, progress counts and elapsed time.

A parent card is marked `you` and shows `waiting on orchestrator` while open. A loop's later rounds get their own cards, labelled `r2`, `r3` and so on, with earlier rounds still visible. A skipped node shows a `skipped` card. An ordered item draws an edge from each item it waited for. The header shows each loop's round out of its maximum, and why it exited.

Clicking a card, or pressing Enter on it, opens a panel with the status, model, why it was picked, duration, inputs, error, output file path, attachments and output. Escape closes it. The Run index button shows `nodes/index.md`. The page reads those files from `/nodes/index.md`, `/nodes/<node>-<index>[.r<n>].md` and `/nodes/<node>-<index>[.r<n>]/<name>`. These are served as plain text with `nosniff`, and only when the real path stays inside `<run-dir>/nodes`; any other path gets 404.
