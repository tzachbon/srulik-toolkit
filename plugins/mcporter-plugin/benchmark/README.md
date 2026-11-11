# Benchmark: native MCP tools vs. mcporter

Question: how many tokens and how much time does the agent save by calling an
MCP server through mcporter instead of the native MCP tools?

## Task

A local stdio MCP server ([fake-inventory-server.js](fake-inventory-server.js))
serves inventory items in pages of 25, each item with a long description. The
agent must return the total stock of every `gold` item. The answer is
deterministic, so every run is graded.

Three arms, same model, same prompt task:

| Arm | Tools the agent has |
| --- | --- |
| `native` | the server's native MCP tools only |
| `mcporter` | Bash plus mcporter; told to write one script for many calls |
| `saved-script` | Bash plus mcporter, and the project already has [inventory-gold-stock.mjs](../skills/mcporter/examples/.mcporter/scripts/inventory-gold-stock.mjs) |

Each run is a fresh `claude -p --output-format json` with settings, hooks,
CLAUDE.md and other MCP servers turned off. Tokens are the input tokens the
model processed (uncached, cache write and cache read summed), as reported by
Claude Code. Times are Claude Code's `duration_ms`. Values are medians of 3 runs.

## Results

2026-11-11, Claude Code 2.1.322, `--model sonnet`, all 18 runs correct (the
whole reply must be the integer). Every run starts in a fresh project folder;
only the `saved-script` arm gets the example scripts.
Raw data: [results-4-pages.json](results-4-pages.json), [results-20-pages.json](results-20-pages.json).

`run.js` now records each run's tool calls (`calls`) and whether the run used
its arm's path (`followed`: native tools only; `mcporter` from Bash; the saved
`inventory-gold-stock.mjs`). The stored results above predate that field. A
traced spot check at 4 pages (one run per arm, same day) followed every arm's
path and matched the stored input tokens within 3: 20,301, 18,334 and 17,143.

### 20 pages (20 tool calls)

| Arm | Turns | Input tokens | Time | Cost |
| --- | ---: | ---: | ---: | ---: |
| native | 21 | 70,149 | 20.0 s | $0.1906 |
| mcporter (writes a script) | 3 | 18,358 (**−74%**) | 21.8 s (+9%) | $0.0228 (−88%) |
| saved-script | 3 | 17,146 (**−76%**) | 10.2 s (**−49%**) | $0.0215 (−89%) |

### 4 pages (4 tool calls)

| Arm | Turns | Input tokens | Time | Cost |
| --- | ---: | ---: | ---: | ---: |
| native | 5 | 20,301 | 7.3 s | $0.0517 |
| mcporter (writes a script) | 3 | 18,336 (−10%) | 13.0 s (+78%) | $0.0225 (−56%) |
| saved-script | 3 | 17,145 (−16%) | 10.1 s (+38%) | $0.0215 (−58%) |

Cost depends on prompt-cache state: in these runs most native input was a
cache write (66,232 of 70,149 tokens at 20 pages), which costs more than a
cache read. An earlier run with a warm cache cost $0.0254 native vs $0.0066
saved-script at 20 pages. Turns and input tokens are stable across runs.

## What it shows

- Native cost grows with every call: each result goes back into context, and
  each call is one more turn. mcporter's cost stays flat, because the script
  returns one number no matter how many calls it makes.
- On a small task, writing a new script saves few tokens and takes longer.
  The win starts once a task makes many calls, or when the script already exists.
- A saved script is the best case: the agent reads the index, runs one
  command, and is done. This is why the `mcporter` skill tells agents to save
  and reuse scripts.

The fake server returns about 3,000 tokens per page. Real servers that return
larger payloads (issues, logs, search results) favor mcporter more; servers
with tiny answers favor it less.

## Run it

```bash
npm install -g mcporter@0.17.0     # or set MCPORTER_NODE_MODULES to a node_modules containing it
node benchmark/run.js --runs 3 --pages 20 --model sonnet
```

It calls the real model (about $0.20 for 9 runs at 20 pages) and writes
`results-<pages>-pages.json`.
