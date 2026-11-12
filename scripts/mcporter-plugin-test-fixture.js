// Shared fixture for the mcporter-plugin behavior tests: a fake mcporter and a temp HOME.
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const plugin = path.join(__dirname, "..", "plugins", "mcporter-plugin");
// Real path: on macOS the temp dir is behind a symlink, and process.cwd() resolves it.
const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "mcporter-plugin-test-")));
const home = path.join(tmp, "home");
fs.mkdirSync(path.join(home, ".codex"), { recursive: true });
fs.mkdirSync(path.join(home, ".claude"), { recursive: true });
// The fake imports serve the entries; the files only need to exist.
fs.writeFileSync(path.join(home, ".claude.json"), "{}");

// Fake mcporter, matching 0.17 behavior the plugin relies on:
// - `config import <kind> --json` lists that kind's entries, first definition of a
//   name only, even across one editor's files; `--path <file>` reads one file;
// - `config list --source import` keeps only the first definition of each name;
// - the home config is $XDG_CONFIG_HOME/mcporter or ~/.mcporter; --persist/--config override it;
// - `list <name> --json` answers ok except for "broken".
const fake = path.join(tmp, "fake-mcporter.js");
fs.writeFileSync(
  fake,
  `const fs=require("fs"),path=require("path");let a=process.argv.slice(2);
const raw=[...a];const opt=(n)=>{const i=a.indexOf(n);if(i===-1)return;const v=a[i+1];a.splice(i,2);return v;};
const x=process.env.XDG_CONFIG_HOME;
const dirs=[...(x?[path.join(x,"mcporter")]:[]),path.join(process.env.HOME,".mcporter")];
const cands=dirs.flatMap(d=>[path.join(d,"mcporter.json"),path.join(d,"mcporter.jsonc")]);
const file=opt("--path");
const cfg=opt("--config")||opt("--persist")||cands.find(c=>fs.existsSync(c))||cands[0];
const read=()=>{try{return JSON.parse(fs.readFileSync(cfg,"utf8"))}catch{return{mcpServers:{}}}};
const write=(c)=>{fs.mkdirSync(path.dirname(cfg),{recursive:true});fs.writeFileSync(cfg,JSON.stringify(c));};
const imports=JSON.parse(process.env.IMPORTS);
const dedup=(xs)=>xs.filter((e,i)=>xs.findIndex(o=>o.name===e.name)===i);
const first=imports.filter((e,i)=>imports.findIndex(o=>o.name===e.name)===i).map(e=>({name:e.name,source:{kind:"import",importKind:e.kind,path:e.path}}));
// Like mcporter, a project config/mcporter.json comes before the home config.
const projCfg=path.resolve("config","mcporter.json");
const layer=(f)=>{try{return Object.keys(JSON.parse(fs.readFileSync(f,"utf8")).mcpServers).map(name=>({name,source:{kind:"local",path:f}}))}catch{return[]}};
const local=()=>{if(process.env.FAKE_LOCAL_THROW&&!raw.includes("--config"))process.exit(1);return lst();};
const lst=()=>process.env.FAKE_LOCAL_EMPTY&&!raw.includes("--config")?[]:dedup([...(raw.includes("--config")?[]:layer(projCfg)),...Object.entries(read().mcpServers).map(([name,d])=>({name,source:{kind:"local",path:cfg},...(d.cwd&&{cwd:d.cwd})}))]);
// Like mcporter 0.17, the default claude-code paths skip a project .mcp.json.
if(a[0]==="config"&&a[1]==="import"&&file&&/broken-editor/.test(fs.readFileSync(file,"utf8"))){console.error("bad config");process.exit(1);}
// Like mcporter 0.17, an import with no entries prints plain text, even with --json.
if(a[0]==="config"&&a[1]==="import"){const es=dedup(imports.filter(e=>e.kind===a[2]&&(file?e.path===file:!e.path.endsWith(".mcp.json")))).map(e=>({name:e.name,entry:{command:"run-"+e.name,...(e.differ&&{args:[e.path]})},source:e.path}));console.log(es.length?JSON.stringify({entries:es}):"No entries found.");}
else if(a[0]==="config"&&a[1]==="list"){const src=opt("--source");console.log(JSON.stringify({servers:src==="import"?first:src==="local"?local():[...local(),...first]}));}
else if(a[0]==="config"&&a[1]==="remove"){const c=read();delete c.mcpServers[a[2]];write(c);}
else if(a[0]==="list"){console.log(JSON.stringify({status:a[1]==="broken"?"offline":a[1]==="oauth"?"auth":"ok"}));}
else process.exit(9);`,
);
// An installed-looking `mcporter` on PATH; MCPORTER_BIN still runs the fake.
const bin = path.join(tmp, "bin");
fs.mkdirSync(bin);
for (const name of ["mcporter", "mcporter.cmd"]) fs.writeFileSync(path.join(bin, name), "", { mode: 0o755 });
const codexHome = path.join(home, ".codex", "config.toml");
const proj = path.join(tmp, "proj");
const projectCodex = path.join(proj, ".codex", "config.toml");
const imports = [
  { name: "inv", kind: "claude-code", path: path.join(home, ".claude.json") },
  { name: "linear", kind: "claude-code", path: path.join(home, ".claude.json") },
  { name: "linear", kind: "codex", path: codexHome },
  { name: "broken", kind: "codex", path: codexHome },
  { name: "projonly", kind: "codex", path: projectCodex },
  { name: "twice", kind: "codex", path: projectCodex },
  { name: "twice", kind: "codex", path: codexHome },
  { name: "split", kind: "codex", path: projectCodex, differ: true },
  { name: "split", kind: "codex", path: codexHome, differ: true },
  { name: "cc", kind: "claude-code", path: path.join(home, ".claude.json") },
  { name: "cc", kind: "claude-code", path: path.join(proj, ".mcp.json"), differ: true },
  { name: "bound", kind: "claude-code", path: path.join(proj, ".mcp.json") },
  { name: "bound", kind: "codex", path: codexHome },
  { name: "oauth", kind: "claude-code", path: path.join(home, ".claude.json") },
  { name: "cur", kind: "cursor", path: path.join(home, ".cursor", "mcp.json") },
  { name: "desk", kind: "claude-desktop", path: path.join(home, "desktop.json") },
  { name: "projmcp", kind: "claude-code", path: path.join(proj, ".mcp.json") },
];
const env = {
  ...process.env,
  CLAUDE_CONFIG_DIR: "",
  HOME: home,
  CODEX_HOME: path.join(home, ".codex"),
  XDG_CONFIG_HOME: path.join(home, ".config"),
  MCPORTER_PLUGIN_DATA: path.join(tmp, "data with 'space"),
  // Inherited from another plugin's session: setup and the hooks must ignore them.
  PLUGIN_DATA: path.join(tmp, "foreign-data"),
  CLAUDE_PLUGIN_DATA: path.join(tmp, "foreign-data"),
  MCPORTER_BIN: fake,
  // setup apply requires a `mcporter` command on PATH (daily calls use it).
  PATH: [bin, process.env.PATH].join(path.delimiter),
  IMPORTS: JSON.stringify(imports),
};
const run = (file, args, input) =>
  execFileSync(process.execPath, [path.join(plugin, file), ...args], { env, encoding: "utf8", input, cwd: proj });

const codexBefore = '[mcp_servers.linear]\ncommand = "npx"\n\n[mcp_servers.broken]\ncommand = "b"\n\n[mcp_servers.twice]\ncommand = "t"\n\n[other]\nk = 1\n';
const projectBefore = '[mcp_servers.projonly]\n"enabled" = true\ncommand = "p"\n\n[mcp_servers.twice]\ncommand = "t"\n';
fs.mkdirSync(path.dirname(projectCodex), { recursive: true });
fs.writeFileSync(projectCodex, projectBefore);
fs.writeFileSync(path.join(proj, ".mcp.json"), "{}");

module.exports = { assert, execFileSync, fs, path, plugin, tmp, home, env, run, proj, codexHome, projectCodex, imports, codexBefore, projectBefore };
