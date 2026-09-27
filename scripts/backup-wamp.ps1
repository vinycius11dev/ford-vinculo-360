param(
  [string]$Database = "ford_vinculo_360",
  [string]$User = "ford",
  [string]$Password = "ford_local",
  [string]$OutputDirectory = "$PSScriptRoot\..\backups"
)

$ErrorActionPreference = "Stop"
$dump = Get-ChildItem "C:\wamp64\bin\mysql\mysql*\bin\mysqldump.exe" | Sort-Object FullName -Descending | Select-Object -First 1
if (-not $dump) { throw "mysqldump.exe não encontrado no WampServer." }
$resolvedOutput = [System.IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Path $resolvedOutput -Force | Out-Null
$file = Join-Path $resolvedOutput "$Database-$(Get-Date -Format 'yyyyMMdd-HHmmss').sql"
$previousPassword = $env:MYSQL_PWD
try {
  $env:MYSQL_PWD = $Password
  & $dump.FullName --host=127.0.0.1 --port=3306 --user=$User --single-transaction --no-tablespaces --routines --events --default-character-set=utf8mb4 --result-file=$file $Database
  if ($LASTEXITCODE -ne 0) { throw "O backup do MySQL falhou com código $LASTEXITCODE." }
} finally {
  if ($null -eq $previousPassword) { Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue } else { $env:MYSQL_PWD = $previousPassword }
}
Write-Output "Backup criado: $file"
