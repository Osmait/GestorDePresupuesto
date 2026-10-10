#!/usr/bin/env bash
# Stops whatever process listens on the given TCP port(s) (by PID, never by name).
#   perf/frontend/stop-port.sh 13461 13462
for port in "$@"; do
  for pid in $(ss -ltnpH "sport = :$port" | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u); do
    echo "stopping pid $pid on :$port"
    kill "$pid"
  done
done
