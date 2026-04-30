$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Invoke-Native {
  param(
    [Parameter(Mandatory = $true)]
    [string]$FilePath,
    [string[]]$ArgumentList = @()
  )

  & $FilePath @ArgumentList
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed with exit code ${LASTEXITCODE}: $FilePath $($ArgumentList -join ' ')"
  }
}

Invoke-Native "pnpm" @("lint")
Invoke-Native "pnpm" @("typecheck")
Invoke-Native "pnpm" @("test")
Invoke-Native "pnpm" @("test:integration")
Invoke-Native "pnpm" @("build")
Invoke-Native "docker" @("compose", "-f", "infra/compose.yml", "config")
Invoke-Native "node" @("scripts/check-offline-assets.mjs")
