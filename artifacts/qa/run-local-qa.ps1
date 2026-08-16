$ErrorActionPreference = "Stop"
$root = "D:\Projects\NhaHang"
$artifacts = Join-Path $root "artifacts\qa"
$processes = @()

try {
  $processes += Start-Process -FilePath "node.exe" `
    -ArgumentList @(Join-Path $artifacts "mock-api.mjs") `
    -WorkingDirectory $root `
    -RedirectStandardOutput (Join-Path $artifacts "mock-api.log") `
    -RedirectStandardError (Join-Path $artifacts "mock-api-error.log") `
    -PassThru

  $env:VITE_API_URL = "http://127.0.0.1:5999"
  $apps = @(
    @{ Name = "landing"; Path = "igourmet-landing"; Port = "5180" },
    @{ Name = "app"; Path = "igourmet-app"; Port = "5181" },
    @{ Name = "internal"; Path = "igourmet-internal"; Port = "5182" }
  )
  foreach ($app in $apps) {
    $processes += Start-Process -FilePath "npm.cmd" `
      -ArgumentList @("run", "dev", "--", "--host", "127.0.0.1", "--port", $app.Port) `
      -WorkingDirectory (Join-Path $root $app.Path) `
      -RedirectStandardOutput (Join-Path $artifacts "$($app.Name).log") `
      -RedirectStandardError (Join-Path $artifacts "$($app.Name)-error.log") `
      -PassThru
  }

  Start-Sleep -Seconds 3
  foreach ($port in @(5180, 5181, 5182, 5999)) {
    $uri = if ($port -eq 5999) { "http://127.0.0.1:5999/api/public/companies" } else { "http://127.0.0.1:$port" }
    $response = Invoke-WebRequest -UseBasicParsing -Uri $uri
    if ($response.StatusCode -ne 200) {
      throw "Port $port did not return HTTP 200"
    }
  }

  $env:NODE_PATH = "C:\Users\ngocson\AppData\Local\npm-cache\_npx\420ff84f11983ee5\node_modules"
  & npx.cmd --yes @playwright/test test "artifacts/qa/local-ui.spec.js" --workers=1 --reporter=list
  exit $LASTEXITCODE
}
finally {
  foreach ($process in $processes) {
    Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
  }
}
