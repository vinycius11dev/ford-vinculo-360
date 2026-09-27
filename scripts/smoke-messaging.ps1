$ErrorActionPreference = "Stop"

$apiBase = "http://127.0.0.1:3000/api/v1"
$runId = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()

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

function Wait-MessageStatus {
  param(
    [Parameter(Mandatory = $true)][string]$AdminToken,
    [Parameter(Mandatory = $true)][string]$TemplateKey,
    [Parameter(Mandatory = $true)][string]$Recipient,
    [int]$TimeoutSeconds = 15
  )
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    $messages = [array](Invoke-Json -Method Get -Path "/messaging?channel=EMAIL" -Token $AdminToken)
    $match = $null
    foreach ($candidate in $messages) {
      if ([string]$candidate.templateKey -eq $TemplateKey -and [string]$candidate.recipient -eq $Recipient) {
        $match = $candidate
        break
      }
    }
    if ($match -and [string]$match.status -ne "PENDING" -and [string]$match.status -ne "SENDING") {
      return $match
    }
    Start-Sleep -Milliseconds 500
  }
  throw "Mensagem $TemplateKey para $Recipient não chegou a um status final em ${TimeoutSeconds}s."
}

# Admin login - manages the messaging queue
$adminLogin = Invoke-Json -Method Post -Path "/auth/login" -Body @{
  email = "admin@ford360.local"
  password = "Ford@360"
}
$adminToken = $adminLogin.accessToken

# Manager login - creates a team invitation, which must enqueue a TEAM_INVITATION e-mail
$managerLogin = Invoke-Json -Method Post -Path "/auth/login" -Body @{
  email = "gerente@ford360.local"
  password = "Ford@360"
}
$managerToken = $managerLogin.accessToken

$inviteEmail = "smoke.messaging.$runId@ford360.local"
$invitation = Invoke-Json -Method Post -Path "/users/team/invitations" -Token $managerToken -Body @{
  fullName = "Consultor Smoke Mensageria"
  email = $inviteEmail
  role = "DEALERSHIP_AGENT"
}
if (-not $invitation.developmentToken) { throw "Convite não retornou developmentToken em ambiente de desenvolvimento." }

$invitationMessage = Wait-MessageStatus -AdminToken $adminToken -TemplateKey "TEAM_INVITATION" -Recipient $inviteEmail
if ($invitationMessage.status -ne "SENT") {
  throw "Mensagem de convite não foi entregue (status: $($invitationMessage.status))."
}
if ($invitationMessage.PSObject.Properties.Name -contains "payload") {
  throw "A API de mensageria expôs o payload privado do convite."
}
$invitationDetail = Invoke-Json -Method Get -Path "/messaging/$($invitationMessage.id)" -Token $adminToken
$sentEvent = $null
foreach ($event in [array]$invitationDetail.events) {
  if ([string]$event.status -eq "SENT") { $sentEvent = $event; break }
}
if (-not $sentEvent -or [string]$sentEvent.detail -ne "Detalhe omitido por segurança.") {
  throw "O evento do convite não foi redigido antes de ser exposto pela API."
}
if ([string]$sentEvent.detail -match 'invite=|reset=|[a-f0-9]{64}') {
  throw "O evento do convite aparenta conter uma credencial."
}

# Password reset - must enqueue a PASSWORD_RESET e-mail for an existing customer
$resetRequest = Invoke-Json -Method Post -Path "/auth/password-reset/request" -Body @{
  email = "carlos@ford360.local"
}
if (-not $resetRequest.developmentToken) { throw "Recuperação de senha não retornou developmentToken em ambiente de desenvolvimento." }

$resetMessage = Wait-MessageStatus -AdminToken $adminToken -TemplateKey "PASSWORD_RESET" -Recipient "carlos@ford360.local"
if ($resetMessage.status -ne "SENT") {
  throw "Mensagem de recuperação de senha não foi entregue (status: $($resetMessage.status))."
}

# Guard rail - only failed messages may be retried
try {
  Invoke-Json -Method Post -Path "/messaging/$($invitationMessage.id)/retry" -Token $adminToken | Out-Null
  throw "O reenvio de uma mensagem já entregue deveria ter sido rejeitado."
} catch {
  if ($_.Exception.Response -and [int]$_.Exception.Response.StatusCode -eq 400) {
    # expected
  } else {
    throw
  }
}

# Access control - a non-admin cannot list the messaging queue
try {
  Invoke-Json -Method Get -Path "/messaging" -Token $managerToken | Out-Null
  throw "Um gerente de concessionária não deveria conseguir listar a fila de mensagens."
} catch {
  if ($_.Exception.Response -and [int]$_.Exception.Response.StatusCode -eq 403) {
    # expected
  } else {
    throw
  }
}

Write-Host "OK: convite e recuperação usam envio sensível, sem expor payload ou links na fila administrativa."
