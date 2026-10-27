#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
plugin_root="$repo_root/plugins/srulik-toolkit"

python3 "$repo_root/scripts/validate/run.py" "$repo_root"

if command -v claude >/dev/null 2>&1; then
  claude plugin validate --strict "$repo_root"
  claude plugin validate --strict "$plugin_root"
fi

if [[ "${GITHUB_EVENT_NAME:-}" == "pull_request" && "${RUNNER_OS:-}" == "Linux" ]]; then
  git fetch --no-tags --depth=1 origin "$GITHUB_BASE_REF"
  "$repo_root/scripts/check-version-bump.sh" FETCH_HEAD
fi

echo "Srulik Toolkit validation passed."
