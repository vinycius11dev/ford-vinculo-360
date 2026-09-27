param(
  [switch]$OpenBrowser,
  [switch]$ExposeDevelopmentTokens
)

$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$logDirectory = Join-Path $projectRoot '.local/logs'
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
$nodeExecutable = (Get-Command node -ErrorAction Stop).Source

function Start-LocalApp([string]$Name, [int]$Port, [string]$Executable, [string[]]$Arguments, [string]$Directory) {
  $probe = [Net.Sockets.TcpClient]::new()
  try { $probe.Connect('127.0.0.1', $Port); Write-Output "$Name ja esta na porta $Port."; return }
  catch { } finally { $probe.Dispose() }
  $process = Start-Process -FilePath $Executable -ArgumentList $Arguments -WorkingDirectory $Directory -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logDirectory "$Name.log") -RedirectStandardError (Join-Path $logDirectory "$Name.error.log")
  Write-Output "$Name iniciado (PID $($process.Id), porta $Port). Logs: $logDirectory"
}

$isMysqlRunning = $false
$mysqlProbe = [Net.Sockets.TcpClient]::new()
try { $mysqlProbe.Connect('127.0.0.1', 3306); $isMysqlRunning = $true }
catch { } finally { $mysqlProbe.Dispose() }

if (-not $isMysqlRunning) {
  $mysql = Get-Service -Name wampmysqld64 -ErrorAction SilentlyContinue
  if ($mysql -and $mysql.Status -ne 'Running') {
    try { Start-Service -Name wampmysqld64 -ErrorAction Stop; $isMysqlRunning = $true }
    catch { Write-Warning 'Inicie o MySQL pelo WampServer. O Windows exige permissao administrativa para iniciar esse servico.' }
  }
}

Start-LocalApp 'web' 5173 $nodeExecutable @('node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5173', '--strictPort') (Join-Path $projectRoot 'apps/web')
$previousOffline = $env:EXPO_OFFLINE
try {
  $env:EXPO_OFFLINE = '1'
  $expoCli = Join-Path $projectRoot 'apps/mobile/node_modules/.bin/expo.cmd'
  Start-LocalApp 'mobile' 8081 $expoCli @('start', '--web', '--host', 'localhost', '--port', '8081') (Join-Path $projectRoot 'apps/mobile')
} finally { $env:EXPO_OFFLINE = $previousOffline }
Start-LocalApp 'ml' 8000 (Join-Path $projectRoot 'apps/ml/.venv/Scripts/python.exe') @('-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000') (Join-Path $projectRoot 'apps/ml')
if ($isMysqlRunning -or (Get-Service -Name wampmysqld64 -ErrorAction SilentlyContinue).Status -eq 'Running') {
  $previousNodeEnv = $env:NODE_ENV
  $previousDevelopmentTokens = $env:EXPOSE_DEVELOPMENT_TOKENS
  try {
    $env:NODE_ENV = 'development'
    $env:EXPOSE_DEVELOPMENT_TOKENS = if ($ExposeDevelopmentTokens) { 'true' } else { 'false' }
    if ($ExposeDevelopmentTokens) {
      Write-Warning 'Tokens de convite/recuperação poderão aparecer nas respostas locais. Use apenas em desenvolvimento e sem SMTP configurado.'
    }
    Start-LocalApp 'api' 3000 $nodeExecutable @('dist/main.js') (Join-Path $projectRoot 'apps/api')
  } finally {
    if ($null -eq $previousNodeEnv) { Remove-Item Env:NODE_ENV -ErrorAction SilentlyContinue }
    else { $env:NODE_ENV = $previousNodeEnv }
    if ($null -eq $previousDevelopmentTokens) { Remove-Item Env:EXPOSE_DEVELOPMENT_TOKENS -ErrorAction SilentlyContinue }
    else { $env:EXPOSE_DEVELOPMENT_TOKENS = $previousDevelopmentTokens }
  }
} else { Write-Warning 'API aguardando MySQL. Execute este script novamente apos iniciar o WampServer.' }

Write-Output 'Painel: http://127.0.0.1:5173 | App: http://127.0.0.1:8081 | API: http://127.0.0.1:3000/docs'
if ($OpenBrowser) {
  Start-Process 'http://127.0.0.1:5173'
  Start-Process 'http://127.0.0.1:8081'
}
