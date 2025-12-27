#!/usr/bin/env pwsh
[CmdletBinding()]
param(
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

function Assert-Command {
  param(
    [Parameter(Mandatory=$true)][string]$Name,
    [Parameter(Mandatory=$true)][string]$Hint
  )
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    Write-Error "$Name not found. $Hint"
  }
}

function Check-Node {
  Assert-Command -Name node -Hint "Install Node.js 18+ (Windows: https://nodejs.org; macOS: brew install node or use nvm)."
  $v = (node -v).TrimStart('v')
  if (-not ($v -as [version] -ge [version]"18.0")) {
    Write-Error "Node version $v detected; need 18+."
  }
}

function Ensure-Rust {
  if (-not (Get-Command rustup -ErrorAction SilentlyContinue)) {
    Write-Host "rustup not found; installing..."
    if ($IsWindows) {
      $rustupPath = Join-Path $env:TEMP "rustup-init.exe"
      Invoke-WebRequest https://win.rustup.rs/x86_64 -OutFile $rustupPath
      & $rustupPath -y
    }
    else {
      curl https://sh.rustup.rs -sSf | sh -s -- -y
    }
    $env:PATH = "$env:USERPROFILE\.cargo\bin:$env:HOME/.cargo/bin;$env:PATH"
  }
  rustup show > $null
  rustup default stable > $null
}

function Check-Tauri-HostDeps {
  if ($IsWindows) {
    Write-Host "Ensure Visual Studio Build Tools with Desktop C++ workload and Windows 10/11 SDK are installed."
    Write-Host "Ensure Microsoft Edge WebView2 runtime is installed."
  }
  else {
    Write-Host "Ensure Xcode Command Line Tools are installed (xcode-select --install)."
    Write-Host "If building Linux targets on macOS, install GTK/WebKit2 via Homebrew (brew install gtk+3 webkit2gtk)."
  }
}

function Run-Step {
  param(
    [Parameter(Mandatory=$true)][string]$Message,
    [Parameter(Mandatory=$true)][scriptblock]$Action
  )
  Write-Host "==> $Message"
  & $Action
}

Push-Location $PSScriptRoot
try {
  Run-Step "Checking Node" { Check-Node }
  Run-Step "Ensuring Rust toolchain" { Ensure-Rust }
  Run-Step "Validating Tauri host dependencies" { Check-Tauri-HostDeps }

  Run-Step "Installing npm dependencies" { npm ci }

  if (-not $SkipBuild) {
    Run-Step "Building UI" { npm run build }
    Run-Step "Building Rust workspace" { cargo build }
  }
  else {
    Write-Host "SkipBuild set; skipping builds."
  }

  Write-Host "Bootstrap complete."
}
finally {
  Pop-Location
}
