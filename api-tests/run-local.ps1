$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$temp = Join-Path $env:TEMP 'igourmet-api-tests'
New-Item -ItemType Directory -Force -Path $temp | Out-Null

$env:PAYOS_CLIENT_ID = ''
$env:PAYOS_API_KEY = ''
$env:PAYOS_CHECKSUM_KEY = ''
$mail = Start-Process -FilePath 'node.exe' -ArgumentList @('fake-resend.js') `
  -WorkingDirectory $PSScriptRoot `
  -RedirectStandardOutput (Join-Path $temp 'mail.out.log') `
  -RedirectStandardError (Join-Path $temp 'mail.err.log') -PassThru

$env:RESEND_API_KEY = 'api-test-local-key'
$env:RESEND_API_URL = 'http://127.0.0.1:8025/emails'
$env:MAIL_USER = 'api-test@example.test'
$env:MAIL_FROM = 'iGourmet API Test <api-test@example.test>'
$backend = Start-Process -FilePath 'npm.cmd' -ArgumentList @('start') `
  -WorkingDirectory (Join-Path $root 'backend') `
  -RedirectStandardOutput (Join-Path $temp 'backend.out.log') `
  -RedirectStandardError (Join-Path $temp 'backend.err.log') -PassThru

try {
  $deadline = (Get-Date).AddSeconds(180)
  $ready = $false
  while ((Get-Date) -lt $deadline) {
    try {
      Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:5000/health' -TimeoutSec 2 | Out-Null
      $ready = $true
      break
    } catch {
      if ($backend.HasExited) { throw "Backend exited with code $($backend.ExitCode)" }
      Start-Sleep -Milliseconds 500
    }
  }
  if (!$ready) { throw 'Backend did not become ready within 180 seconds' }

  & (Join-Path $PSScriptRoot '.venv\Scripts\python.exe') -m pytest --junitxml=reports/junit.xml
  if ($LASTEXITCODE -ne 0) { throw "pytest exited with code $LASTEXITCODE" }
} finally {
  if (!$backend.HasExited) {
    & taskkill.exe /PID $backend.Id /T /F 2>$null | Out-Null
  }
  if (!$mail.HasExited) {
    & taskkill.exe /PID $mail.Id /T /F 2>$null | Out-Null
  }
  "Backend logs: $temp"
}
