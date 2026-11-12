#!/usr/bin/env node
// Deterministic stdio MCP server used only by the benchmark. Node stdlib only.
// Tools: list_items(page) -> 25 verbose items per page; get_item(id).
// INVENTORY_PAGES sets the page count (default 4).
const readline = require('node:readline');

const TAGS = ['red', 'blue', 'green', 'gold'];
const PAGES = Number(process.env.INVENTORY_PAGES) || 4;
const PAGE_SIZE = 25;
const ITEMS = Array.from({ length: PAGES * PAGE_SIZE }, (_, i) => ({
  id: `item-${String(i + 1).padStart(3, '0')}`,
  name: `Widget ${i + 1}`,
  tag: TAGS[(i * 7) % 4],
  stock: (i * 37) % 50,
  warehouse: `WH-${(i % 5) + 1}`,
  description: `Widget ${i + 1} is a standard inventory item kept for benchmark purposes. `.repeat(3).trim(),
}));
const tools = [
  {
    name: 'list_items',
    description: `List inventory items, 25 per page. Pages 1-${PAGES}.`,
    inputSchema: { type: 'object', properties: { page: { type: 'number' } }, required: ['page'] },
  },
  {
    name: 'get_item',
    description: 'Get one inventory item by id.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  },
];

function callTool(name, args = {}) {
  if (name === 'list_items') {
    const page = Number(args.page);
    if (!(page >= 1 && page <= PAGES)) throw new Error(`page must be 1-${PAGES}`);
    const items = ITEMS.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    return { page, pages: PAGES, items };
  }
  if (name === 'get_item') {
    const item = ITEMS.find((it) => it.id === args.id);
    if (!item) throw new Error(`unknown id ${args.id}`);
    return item;
  }
  throw new Error(`unknown tool ${name}`);
}

function handle(msg) {
  const { id, method, params } = msg;
  if (method === 'initialize') {
    return {
      protocolVersion: params?.protocolVersion || '2025-06-18',
      capabilities: { tools: {} },
      serverInfo: { name: 'fake-inventory', version: '1.0.0' },
    };
  }
  if (method === 'tools/list') return { tools };
  if (method === 'tools/call') {
    try {
      const data = callTool(params.name, params.arguments);
      return { content: [{ type: 'text', text: JSON.stringify(data) }], structuredContent: data };
    } catch (err) {
      return { content: [{ type: 'text', text: String(err.message) }], isError: true };
    }
  }
  if (method === 'ping') return {};
  if (id === undefined) return undefined; // notification
  throw Object.assign(new Error(`method not found: ${method}`), { code: -32601 });
}

if (require.main === module) {
  readline.createInterface({ input: process.stdin }).on('line', (line) => {
    if (!line.trim()) return;
    const msg = JSON.parse(line);
    let reply;
    try {
      const result = handle(msg);
      if (result === undefined || msg.id === undefined) return;
      reply = { jsonrpc: '2.0', id: msg.id, result };
    } catch (err) {
      reply = { jsonrpc: '2.0', id: msg.id, error: { code: err.code || -32603, message: err.message } };
    }
    process.stdout.write(JSON.stringify(reply) + '\n');
  });
}

module.exports = { ITEMS, callTool };
