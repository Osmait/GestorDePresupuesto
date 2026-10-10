#!/usr/bin/env bash
# Dump pg_stat_statements of the perf database.
#   usage: pgss-dump.sh <pg-container> <out-dir>
# Writes pgss_total.csv (top 40 by total time), pgss_mean.csv (top 40 by
# mean time, calls > 20), pgss_all.csv (everything) and pgss_sum.csv.
set -euo pipefail
PGC=${1:?container}; D=${2:?out dir}; mkdir -p "$D"
Q="SELECT queryid, calls, round(total_exec_time::numeric,1) AS total_ms, round(mean_exec_time::numeric,3) AS mean_ms,
          round(stddev_exec_time::numeric,3) AS stddev_ms, round(max_exec_time::numeric,2) AS max_ms, rows,
          shared_blks_hit, shared_blks_read,
          round((100.0*total_exec_time/sum(total_exec_time) OVER ())::numeric,1) AS pct_total,
          regexp_replace(query, '\s+', ' ', 'g') AS query
   FROM pg_stat_statements WHERE dbid = (SELECT oid FROM pg_database WHERE datname='perf')"
docker exec "$PGC" psql -q --csv -U postgres -d perf -c "SELECT * FROM ($Q) s ORDER BY total_ms DESC LIMIT 40" >"$D/pgss_total.csv"
docker exec "$PGC" psql -q --csv -U postgres -d perf -c "SELECT * FROM ($Q) s WHERE calls > 20 ORDER BY mean_ms DESC LIMIT 40" >"$D/pgss_mean.csv"
docker exec "$PGC" psql -q --csv -U postgres -d perf -c "SELECT * FROM ($Q) s ORDER BY total_ms DESC" >"$D/pgss_all.csv"
docker exec "$PGC" psql -q --csv -U postgres -d perf -c "SELECT sum(calls) AS calls, round(sum(total_exec_time)::numeric) AS total_ms FROM pg_stat_statements" >"$D/pgss_sum.csv"
