#!/usr/bin/env bash
# Pull-based automatic deployment for watchlist.
#
# The host asks GitHub whether main has moved, rather than GitHub reaching in:
#   * the repository is PUBLIC; a self-hosted Actions runner would let anyone open a
#     pull request from a fork and run their code on this host
#   * no deployment credential lives at GitHub, and nothing inbound is needed
#
# A new commit is only deployed once its CI run is green.

set -euo pipefail

APP_DIR="${WATCHLIST_APP_DIR:-/opt/watchlist}"
BRANCH="${WATCHLIST_BRANCH:-main}"
REPO="${WATCHLIST_REPO:-$(git -C "$APP_DIR" remote get-url origin | sed -E 's#(git@github\.com:|https://github\.com/)##; s#\.git$##')}"

# One run at a time: a slow build must not be started twice.
exec 9<"$0"
flock -n 9 || exit 0

cd "$APP_DIR"

git fetch --quiet --prune origin "$BRANCH"
local_sha=$(git rev-parse HEAD)
remote_sha=$(git rev-parse "origin/$BRANCH")

if [[ "$local_sha" == "$remote_sha" ]]; then
    exit 0
fi

echo "main moved: ${local_sha:0:8} -> ${remote_sha:0:8}"

# --- gate on CI -----------------------------------------------------------------
# Unauthenticated GitHub API: 60 requests an hour. This only asks when there is
# something new, so the limit is out of reach.
verdict=$(
    curl -fsSL --max-time 20 \
        -H "Accept: application/vnd.github+json" \
        "https://api.github.com/repos/$REPO/commits/$remote_sha/check-runs" \
    | python3 -c '
import json, sys
runs = json.load(sys.stdin).get("check_runs", [])
if not runs:
    print("pending")
elif any(r["status"] != "completed" for r in runs):
    print("pending")
elif all(r["conclusion"] == "success" for r in runs):
    print("success")
else:
    print("failed")
' 2>/dev/null || echo "unreachable"
)

case "$verdict" in
    success) echo "CI is green, deploying" ;;
    pending) echo "CI has not finished yet, leaving it for the next run"; exit 0 ;;
    failed)  echo "CI failed for $remote_sha - refusing to deploy" >&2; exit 1 ;;
    *)       echo "could not reach the GitHub API for $REPO" >&2; exit 1 ;;
esac

git reset --hard "origin/$BRANCH"
# Base file ONLY: the dev override must never apply in production.
docker compose -f docker-compose.yml up -d --build
docker image prune -f >/dev/null
docker compose -f docker-compose.yml ps
