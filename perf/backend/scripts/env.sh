#!/usr/bin/env bash
# Credentials for the disposable perf databases and seeded users come from the
# environment, so no password lives in the repo. Any values work, e.g.:
#   export PERF_DB_PASSWORD=$(openssl rand -hex 12) PERF_USER_PASSWORD=$(openssl rand -hex 12)
# PERF_USER_PASSWORD must be the same when seeding and when running k6/scripts.
: "${PERF_DB_PASSWORD:?export PERF_DB_PASSWORD (see perf/backend/README.md)}"
: "${PERF_USER_PASSWORD:?export PERF_USER_PASSWORD (see perf/backend/README.md)}"
export PERF_DB_PASSWORD PERF_USER_PASSWORD
# JSON login body for a seeded user: login_body <email>
login_body() { printf '{"email":"%s","password":"%s"}' "$1" "$PERF_USER_PASSWORD"; }
