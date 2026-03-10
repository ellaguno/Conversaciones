#!/usr/bin/env bash
#
# bump-version.sh — Incrementa la versión del proyecto.
#
# Uso:
#   ./scripts/bump-version.sh patch   # 0.6.0 → 0.6.1
#   ./scripts/bump-version.sh minor   # 0.6.0 → 0.7.0
#   ./scripts/bump-version.sh major   # 0.6.0 → 1.0.0
#   ./scripts/bump-version.sh         # sin argumento: muestra la versión actual

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
VERSION_FILE="$ROOT_DIR/VERSION"
PACKAGE_JSON="$ROOT_DIR/frontend/package.json"
PYPROJECT_TOML="$ROOT_DIR/agent/pyproject.toml"

current_version=$(cat "$VERSION_FILE" | tr -d '[:space:]')

if [[ -z "${1:-}" ]]; then
  echo "$current_version"
  exit 0
fi

bump_type="$1"

IFS='.' read -r major minor patch <<< "$current_version"

case "$bump_type" in
  patch) patch=$((patch + 1)) ;;
  minor) minor=$((minor + 1)); patch=0 ;;
  major) major=$((major + 1)); minor=0; patch=0 ;;
  *)
    echo "Uso: $0 {patch|minor|major}" >&2
    exit 1
    ;;
esac

new_version="$major.$minor.$patch"

# Actualizar VERSION
echo "$new_version" > "$VERSION_FILE"

# Actualizar frontend/package.json
sed -i "s/\"version\": \"$current_version\"/\"version\": \"$new_version\"/" "$PACKAGE_JSON"

# Actualizar agent/pyproject.toml
sed -i "s/^version = \"$current_version\"/version = \"$new_version\"/" "$PYPROJECT_TOML"

echo "$current_version → $new_version"
