<#
  Lets the Local Manga Translator start Ollama for you.

  Registers an "ollama-launch:" link for the current Windows user only (no admin rights).
  Opening that link starts the Ollama server in the background with no window.
  The browser asks once per site whether to open it; tick "Always allow" to skip the prompt.

    powershell -ExecutionPolicy Bypass -File install-ollama-launcher.ps1            # start "ollama serve" hidden (default)
    powershell -ExecutionPolicy Bypass -File install-ollama-launcher.ps1 -UseTrayApp # start the Ollama tray app instead
    powershell -ExecutionPolicy Bypass -File install-ollama-launcher.ps1 -Uninstall
#>
param([switch]$UseTrayApp, [switch]$Uninstall)

$key = 'HKCU:\Software\Classes\ollama-launch'
$folder = Join-Path $env:LOCALAPPDATA 'ollama-launch'

if ($Uninstall) {
  if (Test-Path $key) { Remove-Item -Path $key -Recurse -Force }
  if (Test-Path $folder) { Remove-Item -Path $folder -Recurse -Force }
  Write-Host 'Removed the ollama-launch: link.'
  return
}

$install = Join-Path $env:LOCALAPPDATA 'Programs\Ollama'
$app = Join-Path $install 'ollama app.exe'
$server = Join-Path $install 'ollama.exe'
if (-not (Test-Path $server)) { $server = (Get-Command ollama -ErrorAction SilentlyContinue).Source }

if ($UseTrayApp -and (Test-Path $app)) {
  $command = "`"$app`""
} elseif ($server) {
  # A tiny script that runs "ollama serve" with no console window. If Ollama is already
  # running, the second server cannot bind its port and exits straight away.
  New-Item -ItemType Directory -Path $folder -Force | Out-Null
  $vbs = Join-Path $folder 'start-ollama.vbs'
  $quoted = $server.Replace('"', '""')
  Set-Content -Path $vbs -Encoding ASCII -Value "CreateObject(""WScript.Shell"").Run """"""$quoted"""" serve"", 0, False"
  $command = "wscript.exe `"$vbs`""
} else {
  Write-Error 'Ollama is not installed. Install it from https://ollama.com/download, then run this script again.'
  exit 1
}

New-Item -Path "$key\shell\open\command" -Force | Out-Null
Set-ItemProperty -Path $key -Name '(default)' -Value 'URL:Ollama launcher'
Set-ItemProperty -Path $key -Name 'URL Protocol' -Value ''
Set-ItemProperty -Path "$key\shell\open\command" -Name '(default)' -Value $command
Write-Host "Registered the ollama-launch: link. It runs: $command"
