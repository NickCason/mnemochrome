#!/usr/bin/env bash
# Usage: scripts/steeLL-v1-task.sh <task-name> <output-file> <<'EOF'
# <spec text>
# EOF
set -euo pipefail
TASK="$1"; OUT="$2"
node "$(dirname "$0")/steeLL-v1.mjs" "$TASK" "$OUT"
echo "[steeLL-v1] DONE: $TASK → $OUT" >&2
