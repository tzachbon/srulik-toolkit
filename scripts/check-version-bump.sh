#!/usr/bin/env bash
set -euo pipefail

base="${1:?usage: check-version-bump.sh BASE_COMMIT}"
version_path="plugins/srulik-toolkit/VERSION"

if git diff --quiet "$base" HEAD -- \
  .agents/plugins/marketplace.json \
  .claude-plugin/marketplace.json \
  plugins/srulik-toolkit \
  ":(exclude)$version_path"; then
  echo "No packaged plugin changes; version bump not required."
  exit 0
fi

current_version="$(<"$version_path")"
base_version="$(git show "$base:$version_path" 2>/dev/null || true)"
if [[ "$current_version" == "$base_version" ]]; then
  echo "Packaged plugin changes require a version bump from $current_version." >&2
  exit 1
fi

echo "Plugin version bumped: ${base_version:-<none>} -> $current_version"
