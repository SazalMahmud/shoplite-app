#!/usr/bin/env bash
set -euo pipefail

BASE="${BASE_URL:-http://localhost:3001}"

echo "Waiting for /readyz..."
for i in $(seq 1 60); do
  if curl -fsS "$BASE/readyz" >/dev/null 2>&1; then
    echo "Ready"
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "FAIL: /readyz not available"
    exit 1
  fi
  sleep 2
done

echo "Placing order..."
RESP=$(curl -fsS -X POST "$BASE/orders" \
  -H "Content-Type: application/json" \
  -d '{"product_id":1,"quantity":2}')
ID=$(echo "$RESP" | sed -n 's/.*"id":\([0-9]*\).*/\1/p')
if [ -z "$ID" ]; then
  echo "FAIL: no order id in response: $RESP"
  exit 1
fi
echo "Order id: $ID"

echo "Polling order status..."
for i in $(seq 1 30); do
  STATUS=$(curl -fsS "$BASE/orders/$ID" | sed -n 's/.*"status":"\([A-Z]*\)".*/\1/p')
  echo "  status=$STATUS"
  if [ "$STATUS" = "COMPLETED" ]; then
    echo "PASS"
    exit 0
  fi
  if [ "$STATUS" = "FAILED" ]; then
    echo "FAIL: order FAILED"
    exit 1
  fi
  sleep 2
done

echo "FAIL: order did not complete in time"
exit 1