#!/usr/bin/env bash
# Smoke-check the seeded data through the API.
#   usage: smoke.sh <base-url>     e.g. smoke.sh http://127.0.0.1:18441
# Prints status, bytes and time for every endpoint the k6 scenarios use.
set -euo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/env.sh"
BASE=${1:?base url}
TOKEN=$(curl -fsS -X POST "$BASE/auth/login" -H 'Content-Type: application/json' \
  -d "$(login_body heavy@perf.test)" | sed -E 's/.*"access_token":"([^"]+)".*/\1/')
FROM=$(date -d '-1 year' +%F); TO=$(date +%F)
MFROM=$(date +%Y-%m-01); MTO=$(date -d "$(date +%Y-%m-01) +1 month -1 day" +%F)
hit() {
  curl -sS -o /tmp/smoke.$$ -w "%{http_code} %{size_download}B %{time_total}s  $1 $2\n" \
    -X "$1" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' ${3:+-d "$3"} "$BASE$2"
}
hit GET /account
hit GET /category
hit GET /budget
hit GET "/transaction?page=1&limit=100&sort_by=created_at&sort_order=desc&date_from=$MFROM&date_to=$MTO"
hit GET "/transaction?page=1&limit=20&sort_by=transaction_name&sort_order=asc&type=bill&date_from=$FROM&date_to=$TO"
hit GET "/transaction?page=50&limit=20&sort_by=transaction_name&sort_order=asc"
hit GET "/analytics/dashboard-summary?date_from=$MFROM&date_to=$MTO"
hit GET "/analytics/dashboard-summary?date_from=$FROM&date_to=$TO"
hit GET "/analytics/category-expenses?date_from=$FROM&date_to=$TO"
hit GET /analytics/category-expenses
hit GET /analytics/monthly-summary
hit GET /credit-cards
hit GET /credit-cards/summary
hit GET /investments
hit GET /loan
hit GET /certificate
hit GET /recurring-transactions
hit GET /monthly-plan/summary
hit GET /notifications/history
hit GET "/search?q=Jumbo"
head -c 400 /tmp/smoke.$$; echo; rm -f /tmp/smoke.$$
