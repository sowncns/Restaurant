#!/usr/bin/env bash
# Runs the Selenium UI tests, auto-detecting which port serves the customer app
# vs the internal app (they don't always land on 5173/5174 in that order).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

if [ ! -x ".venv/Scripts/python.exe" ] && [ ! -x ".venv/bin/python" ]; then
  echo "Missing .venv - set it up first:" >&2
  echo "  py -m venv .venv && .venv/Scripts/python.exe -m pip install -r requirements.txt" >&2
  exit 1
fi
PYTHON=".venv/Scripts/python.exe"
[ -x "$PYTHON" ] || PYTHON=".venv/bin/python"

curl -sf --max-time 3 http://localhost:5000/health > /dev/null || {
  echo "Backend not reachable at http://localhost:5000 - start it first (cd backend && npm start)." >&2
  exit 1
}

detect_app() {
  local port=$1
  local html
  html=$(curl -sf --max-time 3 "http://localhost:$port" 2>/dev/null) || { echo "down"; return; }
  if echo "$html" | grep -qi "<title>iGourmet</title>"; then
    echo "customer"
  elif echo "$html" | grep -qi "<title>igourmet-internal</title>"; then
    echo "internal"
  else
    echo "unknown"
  fi
}

CUSTOMER_WEB_URL=""
INTERNAL_WEB_URL=""
for port in 5173 5174 5175; do
  case "$(detect_app "$port")" in
    customer) CUSTOMER_WEB_URL="http://localhost:$port" ;;
    internal) INTERNAL_WEB_URL="http://localhost:$port" ;;
  esac
done

if [ -z "$CUSTOMER_WEB_URL" ] || [ -z "$INTERNAL_WEB_URL" ]; then
  echo "Could not find both frontends running (checked ports 5173-5175)." >&2
  echo "Start them first:" >&2
  echo "  cd igourmet-app && npm run dev -- --host 127.0.0.1 --port 5174" >&2
  echo "  cd igourmet-internal && npm run dev -- --host 127.0.0.1 --port 5173" >&2
  exit 1
fi

echo "customer app: $CUSTOMER_WEB_URL"
echo "internal app: $INTERNAL_WEB_URL"

export CUSTOMER_WEB_URL INTERNAL_WEB_URL

# No args -> just run the main workflow test with the browser visible.
if [ "$#" -eq 0 ]; then
  set -- tests/test_reservation_payment_workflow_ui.py -v --headed
fi

"$PYTHON" -m pytest "$@"
