const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const hint = "Srulik Toolkit skills: to-project, review-pro-max, create-plan, create-pr, stay-in-scope, agent-swarm, tdd, keep-it-simple, research, stop-slop, pr-babysit, resolving-merge-conflicts, fix-ci. Read relevant skills and stay within the requested scope.";
const versionPattern = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const ttl = Number(process.env.SRULIK_TOOLKIT_VERSION_TTL_MS) || 86_400_000;
const timeout = Number(process.env.SRULIK_TOOLKIT_VERSION_TIMEOUT_MS) || 2_000;
const pluginRoot = process.env.PLUGIN_ROOT || process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, "..");
const dataRoot = process.env.PLUGIN_DATA || process.env.CLAUDE_PLUGIN_DATA || path.join(os.tmpdir(), "srulik-toolkit");
const cache = path.join(dataRoot, "upstream-version");
const url = process.env.SRULIK_TOOLKIT_VERSION_URL || "https://raw.githubusercontent.com/tzachbon/srulik-toolkit/main/plugins/srulik-toolkit/VERSION";

function valid(value) {
  return versionPattern.test(value);
}

async function upstreamVersion() {
  try {
    const cached = fs.readFileSync(cache, "utf8").trim();
    if (valid(cached) && Date.now() - fs.statSync(cache).mtimeMs < ttl) return cached;
  } catch {}

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeout) });
    const version = (await response.text()).trim();
    if (!response.ok || !valid(version)) return null;
    fs.mkdirSync(dataRoot, { recursive: true });
    const temporary = `${cache}.${process.pid}`;
    fs.writeFileSync(temporary, `${version}\n`);
    fs.renameSync(temporary, cache);
    return version;
  } catch {
    return null;
  }
}

(async () => {
  console.log(hint);
  try {
    const installed = fs.readFileSync(path.join(pluginRoot, "VERSION"), "utf8").trim();
    const upstream = valid(installed) && await upstreamVersion();
    if (upstream && upstream !== installed) {
      console.log(`Srulik Toolkit ${installed} is installed; ${upstream} is available. Upgrade the plugin, then restart your coding agent.`);
    }
  } catch {}
})();
