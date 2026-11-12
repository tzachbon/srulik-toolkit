#!/usr/bin/env node
// inventory-gold-stock.mjs [tag]
// Purpose: total stock of every item with <tag> (default "gold") across all pages.
// Servers: inventory (list_items). Output: one integer on stdout. Errors: stderr, exit 1.
// Needs: npm install --save-dev mcporter@0.17.0 (Node resolves the import from node_modules).
// Check: mcporter replay inventory-gold-stock -- node .mcporter/scripts/inventory-gold-stock.mjs
import { createRuntime } from 'mcporter';

const tag = process.argv[2] ?? 'gold';
const runtime = await createRuntime();
try {
  let total = 0;
  for (let page = 1, pages = 1; page <= pages; page++) {
    const { structuredContent: data } = await runtime.callTool('inventory', 'list_items', { args: { page } });
    pages = data.pages;
    total += data.items.filter((item) => item.tag === tag).reduce((sum, item) => sum + item.stock, 0);
  }
  console.log(total);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await runtime.close();
}
