param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$PytestArgs
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$python = Join-Path $PSScriptRoot '.venv\Scripts\python.exe'
if (-not (Test-Path $python)) {
  Write-Error "Missing .venv - set it up first:`n  py -m venv .venv; .venv\Scripts\python.exe -m pip install -r requirements.txt"
  exit 1
}

try {
  Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:5000/health' -TimeoutSec 3 | Out-Null
} catch {
  Write-Error "Backend not reachable at http://localhost:5000 - start it first (cd backend; npm start)."
  exit 1
}

function Detect-App($port) {
  try {
    $html = (Invoke-WebRequest -UseBasicParsing -Uri "http://localhost:$port" -TimeoutSec 3).Content
  } catch {
    return 'down'
  }
  if ($html -match '<title>iGourmet</title>') { return 'customer' }
  if ($html -match '<title>igourmet-internal</title>') { return 'internal' }
  return 'unknown'
}

$customerUrl = $null
$internalUrl = $null
foreach ($port in 5173, 5174, 5175) {
  switch (Detect-App $port) {
    'customer' { $customerUrl = "http://localhost:$port" }
    'internal' { $internalUrl = "http://localhost:$port" }
  }
}

if (-not $customerUrl -or -not $internalUrl) {
  Write-Error @"
Could not find both frontends running (checked ports 5173-5175).
Start them first:
  cd igourmet-app; npm run dev -- --host 127.0.0.1 --port 5174
  cd igourmet-internal; npm run dev -- --host 127.0.0.1 --port 5173
"@
  exit 1
}

Write-Output "customer app: $customerUrl"
Write-Output "internal app: $internalUrl"

$env:CUSTOMER_WEB_URL = $customerUrl
$env:INTERNAL_WEB_URL = $internalUrl

if (-not $PytestArgs -or $PytestArgs.Count -eq 0) {
  $PytestArgs = @('tests/test_reservation_payment_workflow_ui.py', '-v', '--headed')
}

& $python -m pytest @PytestArgs
