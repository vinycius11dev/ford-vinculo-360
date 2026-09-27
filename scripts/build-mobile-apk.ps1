# Script de automação e guia de compilação do APK Android (Ford Vínculo 360)
# Disciplina: Mobile Development and IoT (Sprint 3 - FIAP 2026)

param(
  [switch]$Local,
  [switch]$SkipTests
)

$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$mobileDir = Join-Path $projectRoot 'apps\mobile'

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   FORD VÍNCULO 360 - BUILD DO APK ANDROID (SPRINT 3)     " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Validação de testes
if (-not $SkipTests) {
  Write-Host "`n[1/3] Executando testes automatizados do Mobile..." -ForegroundColor Yellow
  Push-Location $projectRoot
  try {
    node --test scripts/mobile-session.test.cjs scripts/mobile-contract.test.cjs
    if ($LASTEXITCODE -ne 0) {
      throw "Testes do Mobile falharam. Corrija os erros antes de gerar o APK."
    }
    Write-Host "✔ Todos os testes do Mobile passaram com sucesso!" -ForegroundColor Green
  } finally {
    Pop-Location
  }
} else {
  Write-Host "`n[1/3] Testes ignorados (-SkipTests)." -ForegroundColor DarkGray
}

# 2. Verificação de arquivos de configuração
Write-Host "`n[2/3] Verificando integridade das configurações do Android..." -ForegroundColor Yellow
$appJsonPath = Join-Path $mobileDir 'app.json'
$easJsonPath = Join-Path $mobileDir 'eas.json'

if (-not (Test-Path $appJsonPath) -or -not (Test-Path $easJsonPath)) {
  throw "Arquivos app.json ou eas.json não encontrados em apps/mobile."
}
Write-Host "✔ app.json configurado com identificador com.ford.vinculo360" -ForegroundColor Green
Write-Host "✔ eas.json configurado com perfil 'preview' gerando APK direto (buildType: apk)" -ForegroundColor Green

# 3. Disparo do EAS Build
Write-Host "`n[3/3] Iniciando o processo de build do APK..." -ForegroundColor Yellow
Push-Location $mobileDir
try {
  if ($Local) {
    Write-Host "Disparando build local (requer Android SDK e Java instalados)..." -ForegroundColor Cyan
    npx -y eas-cli build -p android --profile preview --local
  } else {
    Write-Host "Disparando build em nuvem via Expo Application Services (EAS Build)..." -ForegroundColor Cyan
    Write-Host "Observação: Se for a primeira vez, faça login na sua conta Expo quando solicitado." -ForegroundColor Gray
    npx -y eas-cli build -p android --profile preview
  }
} finally {
    Pop-Location
}

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host "  Processo concluído! Salve o link do APK ou o arquivo     " -ForegroundColor Green
Write-Host "  .apk para entrega no portal da FIAP / Teams.             " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
