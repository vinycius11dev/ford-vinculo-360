param([switch]$Integration)

$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Push-Location $projectRoot
try {
  & './apps/web/node_modules/.bin/tsc.cmd' --noEmit -p apps/web/tsconfig.app.json
  if ($LASTEXITCODE -ne 0) { throw 'Falha no TypeScript do painel.' }
  node --stack-size=8192 ./apps/mobile/node_modules/typescript/bin/tsc --noEmit -p apps/mobile/tsconfig.json
  if ($LASTEXITCODE -ne 0) { throw 'Falha no TypeScript do app.' }
  node --test scripts/mobile-session.test.cjs
  if ($LASTEXITCODE -ne 0) { throw 'Falha nos testes de sessao do app.' }
  node --test scripts/mobile-contract.test.cjs
  if ($LASTEXITCODE -ne 0) { throw 'Falha nos contratos de fluxo do app.' }
  $health = Invoke-RestMethod 'http://127.0.0.1:3000/api/v1/health' -TimeoutSec 10
  if ($health.status -ne 'ok' -or -not $health.checks.database -or -not $health.checks.machineLearning) {
    throw 'API, banco ou ML degradado. Confira os logs em .local/logs.'
  }
  foreach ($port in @(5173, 8081)) {
    $probe = [Net.Sockets.TcpClient]::new()
    try {
      if (-not $probe.ConnectAsync('127.0.0.1', $port).Wait(3000)) { throw "Timeout na porta $port." }
    } finally { $probe.Dispose() }
  }
  if ($Integration) {
    # Cria e remove somente fixtures identificadas; preserva auditoria.
    node scripts/regression.test.cjs
    if ($LASTEXITCODE -ne 0) { throw 'Falha nos testes de integracao.' }
    node --test scripts/pilot-import.test.cjs
    if ($LASTEXITCODE -ne 0) { throw 'Falha no teste de importacao do piloto.' }
    node --test scripts/campaign-dispatch.test.cjs
    if ($LASTEXITCODE -ne 0) { throw 'Falha no teste de jornada de campanha.' }
  }
  Write-Output 'Verificacao local aprovada. Nao substitui QA visual, teste nativo ou homologacao de producao.'
} finally { Pop-Location }
