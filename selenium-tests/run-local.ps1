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

$env:CUSTOMER_WEB_URL = 'http://127.0.0.1:5173'
$env:INTERNAL_WEB_URL = 'http://127.0.0.1:5174'
$env:API_BASE_URL = 'http://127.0.0.1:5000/api'
if (-not $env:SELENIUM_TIMEOUT) { $env:SELENIUM_TIMEOUT = '30' }

Write-Output "customer app: $env:CUSTOMER_WEB_URL"
Write-Output "internal app: $env:INTERNAL_WEB_URL"
Write-Output "backend api:  $env:API_BASE_URL"

if (-not $PytestArgs -or $PytestArgs.Count -eq 0) {
  $PytestArgs = @('tests/test_reservation_payment_workflow_ui.py', '-v', '--headed')
}

& $python -m pytest @PytestArgs
