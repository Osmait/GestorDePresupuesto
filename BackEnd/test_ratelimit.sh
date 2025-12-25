#!/bin/bash

# Default port
PORT=8080

echo "=== Rate Limit Tester (Curl Only) ==="
echo "Target: http://localhost:$PORT/health"
echo "Sending 160 requests to ensure default limits (100 req + 50 burst) are exceeded..."
echo "NOTE: If you are running with default config, '127.0.0.1' is WHITELISTED, so you might see all 200 OK."
echo "To test blocking, run server with: RATE_LIMIT_IP_WHITELIST=\"\" go run main.go"
echo "---------------------------------------------------"

for i in {1..160}
do
   # Get HTTP status code and Remaining header
   RESPONSE=$(curl -s -D - -o /dev/null http://localhost:$PORT/health)
   STATUS=$(echo "$RESPONSE" | grep "HTTP/" | awk '{print $2}')
   REMAINING=$(echo "$RESPONSE" | grep -i "X-RateLimit-Remaining" | awk '{print $2}' | tr -d '\r')

   if [ "$STATUS" == "200" ]; then
       echo "Req $i: ✅ 200 OK | Remaining: $REMAINING"
   elif [ "$STATUS" == "429" ]; then
       echo "Req $i: 🛡️ 429 Too Many Requests | Blocked!"
   else
       echo "Req $i: ⚠️ $STATUS"
   fi
done

echo "---------------------------------------------------"
echo "Test Complete."
