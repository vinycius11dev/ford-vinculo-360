$ErrorActionPreference = "Stop"

$apiBase = "http://127.0.0.1:3000/api/v1"
$runId = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$inviteEmail = "smoke.support.$runId@ford360.local"
$initialPassword = "Ford@360-Teste"
$newPassword = "Ford@360-Nova"

function Invoke-Json {
  param(
    [Parameter(Mandatory = $true)][string]$Method,
    [Parameter(Mandatory = $true)][string]$Path,
    [string]$Token,
    [object]$Body
  )
  $headers = @{}
  if ($Token) { $headers.Authorization = "Bearer $Token" }
  $parameters = @{
    Method = $Method
    Uri = "$apiBase$Path"
    Headers = $headers
    ContentType = "application/json"
  }
  if ($null -ne $Body) {
    $parameters.Body = $Body | ConvertTo-Json -Depth 8
  }
  Invoke-RestMethod @parameters
}

$manager = Invoke-Json -Method Post -Path "/auth/login" -Body @{
  email = "gerente@ford360.local"
  password = "Ford@360"
}

$invitation = Invoke-Json -Method Post -Path "/users/team/invitations" -Token $manager.accessToken -Body @{
  fullName = "Consultor Smoke Suporte"
  email = $inviteEmail
  phone = "+55 11 90000-0000"
  role = "DEALERSHIP_AGENT"
}
if (-not $invitation.developmentToken) {
  throw "O ambiente local não retornou o token de desenvolvimento do convite."
}

$accepted = Invoke-Json -Method Post -Path "/auth/invitations/accept" -Body @{
  token = $invitation.developmentToken
  password = $initialPassword
}
if ($accepted.user.email -ne $inviteEmail) { throw "Convite não ativou o usuário esperado." }

$ticket = Invoke-Json -Method Post -Path "/support-tickets" -Token $accepted.accessToken -Body @{
  subject = "Validação automatizada da Central de Suporte"
  message = "Chamado persistente criado pelo teste integrado de acesso e atendimento."
  category = "ACCESS"
  priority = "NORMAL"
}

$inProgress = Invoke-Json -Method Patch -Path "/support-tickets/$($ticket.id)" -Token $manager.accessToken -Body @{
  status = "IN_PROGRESS"
  resolution = "Identidade e escopo da concessionária validados."
}
if ($inProgress.status -ne "IN_PROGRESS") { throw "Chamado não entrou em atendimento." }

$reset = Invoke-Json -Method Post -Path "/auth/password-reset/request" -Body @{
  email = $inviteEmail
}
if (-not $reset.developmentToken) {
  throw "O ambiente local não retornou o token de recuperação."
}
Invoke-Json -Method Post -Path "/auth/password-reset/confirm" -Body @{
  token = $reset.developmentToken
  password = $newPassword
} | Out-Null

$renewed = Invoke-Json -Method Post -Path "/auth/login" -Body @{
  email = $inviteEmail
  password = $newPassword
}
Invoke-Json -Method Post -Path "/auth/logout-all" -Token $renewed.accessToken | Out-Null

$revoked = $false
try {
  Invoke-Json -Method Get -Path "/auth/me" -Token $renewed.accessToken | Out-Null
} catch {
  if ($_.Exception.Response.StatusCode.value__ -eq 401) { $revoked = $true } else { throw }
}
if (-not $revoked) { throw "A sessão permaneceu válida após a revogação." }

$resolved = Invoke-Json -Method Patch -Path "/support-tickets/$($ticket.id)" -Token $manager.accessToken -Body @{
  status = "RESOLVED"
  resolution = "Fluxo completo validado pelo teste automatizado."
}
if ($resolved.status -ne "RESOLVED") { throw "Chamado não foi resolvido." }

Write-Host "OK: convite, ativação, suporte, recuperação e revogação de sessão validados."
Write-Host "Usuário de teste: $inviteEmail"
Write-Host "Chamado: $($ticket.id)"
