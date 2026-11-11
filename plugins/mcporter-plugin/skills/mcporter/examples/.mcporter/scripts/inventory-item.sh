#!/usr/bin/env bash
# inventory-item.sh <id>
# Purpose: one item's name, tag and stock as TSV. Single call, so the CLI is enough.
# Servers: inventory (get_item). Output: "name<TAB>tag<TAB>stock". Errors: exit non-zero.
set -euo pipefail
id="${1:?usage: inventory-item.sh <id>}"
mcporter call inventory.get_item "id:$id" --output json | jq -r '[.name, .tag, .stock] | @tsv'
