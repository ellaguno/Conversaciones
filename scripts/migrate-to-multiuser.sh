#!/bin/bash
# Migration script: Move existing data from agent/{sessions,conversations} to data/admin/
# Run this ONCE after upgrading to the multi-user version.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

DATA_DIR="$PROJECT_ROOT/data"
ADMIN_DIR="$DATA_DIR/admin"

# Check if already migrated
if [ -f "$DATA_DIR/.migrated" ]; then
    echo "Already migrated. Skipping."
    exit 0
fi

echo "=== Migrating to multi-user data structure ==="
echo "Project root: $PROJECT_ROOT"

# Create admin data directories
mkdir -p "$ADMIN_DIR/sessions"
mkdir -p "$ADMIN_DIR/conversations"

# Move sessions
if [ -d "$PROJECT_ROOT/agent/sessions" ] && [ "$(ls -A "$PROJECT_ROOT/agent/sessions" 2>/dev/null)" ]; then
    echo "Moving agent/sessions/* to data/admin/sessions/"
    cp -r "$PROJECT_ROOT/agent/sessions/"* "$ADMIN_DIR/sessions/" 2>/dev/null || true
    echo "  Done. Original files preserved in agent/sessions/ (remove manually when ready)"
else
    echo "No existing sessions to migrate."
fi

# Move conversations
if [ -d "$PROJECT_ROOT/agent/conversations" ] && [ "$(ls -A "$PROJECT_ROOT/agent/conversations" 2>/dev/null)" ]; then
    echo "Moving agent/conversations/* to data/admin/conversations/"
    cp -r "$PROJECT_ROOT/agent/conversations/"* "$ADMIN_DIR/conversations/" 2>/dev/null || true
    echo "  Done. Original files preserved in agent/conversations/ (remove manually when ready)"
else
    echo "No existing conversations to migrate."
fi

# Move metrics
if [ -f "$PROJECT_ROOT/agent/metrics.json" ]; then
    echo "Moving agent/metrics.json to data/admin/metrics.json"
    cp "$PROJECT_ROOT/agent/metrics.json" "$ADMIN_DIR/metrics.json"
    echo "  Done."
else
    echo "No existing metrics to migrate."
fi

# Mark as migrated
date -Iseconds > "$DATA_DIR/.migrated"

echo ""
echo "=== Migration complete ==="
echo "Data is now in: $ADMIN_DIR"
echo ""
echo "Next steps:"
echo "  1. Start the frontend — users.json will be created automatically on first login"
echo "  2. Login as admin (same credentials as before)"
echo "  3. Go to 'Usuarios' to create new users"
echo "  4. Once verified, you can remove the old directories:"
echo "     rm -rf agent/sessions agent/conversations agent/metrics.json"
