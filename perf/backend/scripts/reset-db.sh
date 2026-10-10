#!/usr/bin/env bash
# Drop and recreate the perf database inside a perf Postgres container.
#   usage: reset-db.sh <container> [bypassrls|norls]
# bypassrls (default): role "perf" gets BYPASSRLS. This is the setting used
#   for the branch-vs-main comparison: on `main` many repositories run their
#   queries on the pool instead of the RLS transaction, so with policies
#   enforced main returns empty result sets (it only works in production
#   because the DB role bypasses RLS). With BYPASSRLS both versions return
#   the same data.
# norls: role "perf" is subject to the FORCE ROW LEVEL SECURITY policies
#   (branch only; used to measure the cost of the RLS policies themselves).
set -euo pipefail
C=${1:?container}; MODE=${2:-bypassrls}
docker exec "$C" psql -q -U postgres -c "DROP DATABASE IF EXISTS perf WITH (FORCE);"
docker exec "$C" psql -q -U postgres -c "CREATE DATABASE perf OWNER perf;"
docker exec "$C" psql -q -U postgres -d perf -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements;"
if [ "$MODE" = "bypassrls" ]; then
  docker exec "$C" psql -q -U postgres -c "ALTER ROLE perf BYPASSRLS;"
else
  docker exec "$C" psql -q -U postgres -c "ALTER ROLE perf NOBYPASSRLS;"
fi
echo "$C: database perf recreated (mode=$MODE)"
