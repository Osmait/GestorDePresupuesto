#!/usr/bin/env bash
# Restart a backend with the arguments it was last started with.
#   usage: restart-backend.sh <log-file>
set -euo pipefail
LOG=${1:?log}
HERE=$(cd "$(dirname "$0")" && pwd)
ARGS=$(cat "$LOG.args")
"$HERE/stop-backend.sh" "$LOG"
eval "\"$HERE/run-backend.sh\" $ARGS"
