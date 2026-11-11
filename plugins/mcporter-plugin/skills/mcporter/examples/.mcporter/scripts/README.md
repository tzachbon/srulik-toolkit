# MCP scripts

One line per script. Check this list before writing a new one.

| Script | Purpose | Args | Output | Fixture |
| --- | --- | --- | --- | --- |
| `inventory-gold-stock.mjs` | Total stock for one tag across all pages | `[tag]` | integer | `fixtures/inventory-gold-stock.ndjson` |
| `inventory-item.sh` | One item as TSV | `<id>` | `name\ttag\tstock` | none (single call) |
