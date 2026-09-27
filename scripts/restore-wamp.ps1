param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile,
  [Parameter(Mandatory = $true)]
  [string]$TargetDatabase,
  [Parameter(Mandatory = $true)]
  [string]$Confirmation
)

$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$node = Get-Command node -ErrorAction Stop

Push-Location $projectRoot
try {
  & $node.Source 'scripts/secure-backup.cjs' 'restore' '--file' $BackupFile '--database' $TargetDatabase '--confirm' $Confirmation
  if ($LASTEXITCODE -ne 0) { throw "A restauração cifrada falhou com código $LASTEXITCODE." }
} finally {
  Pop-Location
}
