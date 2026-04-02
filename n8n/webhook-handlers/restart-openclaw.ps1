param(
  [string]$MediaForgePath = $env:MEDIAFORGE_PATH
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($MediaForgePath)) {
  $MediaForgePath = "C:\Users\sinmb\workspace\mediaforge"
}

$desktopExe = Join-Path $MediaForgePath "desktop\release\win-unpacked\MediaForge.exe"

if (Test-Path $desktopExe) {
  Start-Process -FilePath $desktopExe | Out-Null
  Write-Output "Started desktop runtime: $desktopExe"
  exit 0
}

Start-Process -FilePath "powershell.exe" -ArgumentList @(
  "-NoProfile",
  "-Command",
  "Set-Location '$MediaForgePath'; npm run engine -- dashboard"
) | Out-Null

Write-Output "Started dashboard runtime from workspace: $MediaForgePath"
