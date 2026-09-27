$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$node = Get-Command node -ErrorAction Stop

Push-Location $projectRoot
try {
  & $node.Source 'scripts/secure-backup.cjs' backup
  if ($LASTEXITCODE -ne 0) { throw "A rotina de backup cifrado falhou com código $LASTEXITCODE." }
} finally {
  Pop-Location
}
