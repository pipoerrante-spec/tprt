#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-https://tprt-three.vercel.app}"

need() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing dependency: $1" >&2
    exit 1
  }
}

need curl
need jq

echo "Smoke testing: $BASE_URL"

SERVICE_ID="$(curl -sS "$BASE_URL/api/catalog/services" | jq -r '.services[0].id // empty')"
if [[ -z "$SERVICE_ID" ]]; then
  echo "FAIL: no service id from /api/catalog/services" >&2
  exit 1
fi
echo "OK: service_id=$SERVICE_ID"

COMMUNE_ID="$(curl -sS "$BASE_URL/api/catalog/communes?serviceId=$SERVICE_ID" | jq -r '.communes[0].id // empty')"
if [[ -z "$COMMUNE_ID" ]]; then
  echo "FAIL: no commune id from /api/catalog/communes" >&2
  exit 1
fi
echo "OK: commune_id=$COMMUNE_ID"

VEHICLE_JSON="$(curl -sS -X POST "$BASE_URL/api/vehicle/lookup" \
  -H 'content-type: application/json' \
  --data '{"plate":"SBGY61"}')"
VEHICLE_SOURCE="$(echo "$VEHICLE_JSON" | jq -r '.vehicle.source // empty')"
if [[ "$VEHICLE_SOURCE" != "getapi_patente" ]]; then
  echo "FAIL: vehicle lookup source is '$VEHICLE_SOURCE' (expected getapi_patente)" >&2
  echo "Body: $VEHICLE_JSON" >&2
  exit 1
fi
echo "OK: vehicle lookup source=getapi_patente"

DATE_FROM="$(date -u +%F)"
DATE_TO="$(python3 - <<'PY'
from datetime import date, timedelta
print((date.today() + timedelta(days=7)).isoformat())
PY
)"

SLOTS_JSON="$(curl -sS "$BASE_URL/api/availability?serviceId=$SERVICE_ID&communeId=$COMMUNE_ID&dateFrom=$DATE_FROM&dateTo=$DATE_TO")"
CANDIDATES="$(echo "$SLOTS_JSON" | jq -r '.slots[] | select(.available == true and (.remaining // 0) > 0) | "\(.remaining)\t\(.date)\t\(.time)"' | sort -rn | head -n 4)"
if [[ -z "$CANDIDATES" ]]; then
  echo "FAIL: no available slots" >&2
  exit 1
fi

echo "Trying Webpay QA checkout on first available slots..."
CHECKOUT_OK=0
ATTEMPTS=0
while IFS=$'\t' read -r SLOT_REMAINING SLOT_DATE SLOT_TIME; do
  ATTEMPTS=$((ATTEMPTS + 1))
  if [[ "$ATTEMPTS" -gt 4 ]]; then
    break
  fi

  HOLD_PAYLOAD="$(jq -nc \
    --arg sid "$SERVICE_ID" \
    --arg cid "$COMMUNE_ID" \
    --arg d "$SLOT_DATE" \
    --arg t "$SLOT_TIME" \
    '{serviceId:$sid,communeId:$cid,date:$d,time:$t}')"
  HOLD_CODE="$(curl -sS -o /tmp/smoke_hold.json -w '%{http_code}' \
    -X POST "$BASE_URL/api/holds" \
    -H 'content-type: application/json' \
    --data "$HOLD_PAYLOAD")"
  HOLD_BODY="$(cat /tmp/smoke_hold.json)"
  if [[ "$HOLD_CODE" == "429" ]]; then
    RESET_AT="$(echo "$HOLD_BODY" | jq -r '.resetAt // empty')"
    echo "FAIL: /api/holds rate limited. resetAt=$RESET_AT" >&2
    exit 1
  fi
  if [[ "$HOLD_CODE" != "201" ]]; then
    echo "skip: hold $SLOT_DATE $SLOT_TIME (remaining=$SLOT_REMAINING) -> $HOLD_CODE $HOLD_BODY"
    continue
  fi
  HOLD_ID="$(echo "$HOLD_BODY" | jq -r '.holdId // empty')"
  if [[ -z "$HOLD_ID" ]]; then
    echo "skip: hold response missing holdId ($HOLD_BODY)"
    continue
  fi

  CHECKOUT_PAYLOAD="$(jq -nc \
    --arg holdId "$HOLD_ID" \
    '{holdId:$holdId,customerName:"Smoke QA",email:"qa@example.com",phone:"912345678",vehiclePlate:"SBGY61",vehicleMake:"OPEL",vehicleModel:"CORSA",vehicleYear:2022,address:"Calle QA 123",notes:null,couponCode:null,provider:"transbank_webpay"}')"
  CHECKOUT_CODE="$(curl -sS -o /tmp/smoke_checkout.json -w '%{http_code}' \
    -X POST "$BASE_URL/api/checkout/start" \
    -H 'content-type: application/json' \
    --data "$CHECKOUT_PAYLOAD")"
  CHECKOUT_BODY="$(cat /tmp/smoke_checkout.json)"
  if [[ "$CHECKOUT_CODE" == "429" ]]; then
    RESET_AT="$(echo "$CHECKOUT_BODY" | jq -r '.resetAt // empty')"
    echo "FAIL: /api/checkout/start rate limited. resetAt=$RESET_AT" >&2
    exit 1
  fi

  if [[ "$CHECKOUT_CODE" == "200" ]]; then
    REDIRECT_URL="$(echo "$CHECKOUT_BODY" | jq -r '.redirectUrl // empty')"
    if echo "$REDIRECT_URL" | grep -q '/pago/webpay' && echo "$REDIRECT_URL" | grep -q 'webpay'; then
      echo "OK: webpay checkout ready ($SLOT_DATE $SLOT_TIME, remaining=$SLOT_REMAINING)"
      echo "redirectUrl=$REDIRECT_URL"
      CHECKOUT_OK=1
      break
    fi
    echo "FAIL: checkout 200 but unexpected redirectUrl"
    echo "Body: $CHECKOUT_BODY"
    exit 1
  fi

  echo "skip: checkout $SLOT_DATE $SLOT_TIME (remaining=$SLOT_REMAINING) -> $CHECKOUT_CODE $CHECKOUT_BODY"
done <<< "$CANDIDATES"

if [[ "$CHECKOUT_OK" != "1" ]]; then
  echo "FAIL: unable to validate webpay checkout on candidate slots" >&2
  exit 1
fi

echo "SMOKE OK: patent + webpay QA operational on $BASE_URL"
