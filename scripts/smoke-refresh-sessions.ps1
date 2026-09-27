$ErrorActionPreference = "Stop"

$apiBase = "http://127.0.0.1:3000/api/v1"
$runId = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$primaryBrowser = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$secondaryBrowser = New-Object Microsoft.PowerShell.Commands.WebRequestSession

function Invoke-Json {
  param(
    [Parameter(Mandatory = $true)][string]$Method,
    [Parameter(Mandatory = $true)][string]$Path,
    [Microsoft.PowerShell.Commands.WebRequestSession]$Session,
    [string]$Token,
    [string]$UserAgent = "Ford360-Smoke/1.0 Windows Chrome",
    [object]$Body
  )
  $headers = @{}
  if ($Token) { $headers.Authorization = "Bearer $Token" }
  $parameters = @{
    Method = $Method
    Uri = "$apiBase$Path"
    Headers = $headers
    ContentType = "application/json"
    UserAgent = $UserAgent
  }
  if ($Session) { $parameters.WebSession = $Session }
  if ($null -ne $Body) {
    $parameters.Body = $Body | ConvertTo-Json -Depth 8
  }
  $result = Invoke-RestMethod @parameters
  if ($result -is [array]) {
    foreach ($item in $result) { Write-Output $item }
  } else {
    $result
  }
}

function Assert-Unauthorized {
  param([scriptblock]$Request, [string]$Message)
  $blocked = $false
  try {
    & $Request | Out-Null
  } catch {
    if ([int]$_.Exception.Response.StatusCode -eq 401) {
      $blocked = $true
    } else {
      throw
    }
  }
  if (-not $blocked) { throw $Message }
}

$credentials = @{
  email = "smoke.refresh.$runId@ford360.local"
  password = "Ford@360-Teste"
}

$firstLogin = Invoke-Json -Method Post -Path "/auth/register" -Session $primaryBrowser -Body @{
  fullName = "Cliente Smoke Sessões"
  email = $credentials.email
  password = $credentials.password
  phone = "+55 11 90000-0000"
}
$firstToken = $firstLogin.accessToken
$initialSessions = @(Invoke-Json -Method Get -Path "/auth/sessions" -Session $primaryBrowser -Token $firstToken)
if ($initialSessions.Count -lt 1) { throw "A primeira sessão não foi persistida." }

$rotation = Invoke-Json -Method Post -Path "/auth/refresh" -Session $primaryBrowser
$rotatedToken = $rotation.accessToken
if (-not $rotatedToken -or $rotatedToken -eq $firstToken) {
  throw "A rotação não emitiu um novo access token."
}
Assert-Unauthorized -Message "O token ligado à sessão anterior continuou válido." -Request {
  Invoke-Json -Method Get -Path "/auth/me" -Token $firstToken
}

$secondLogin = Invoke-Json -Method Post -Path "/auth/login" -Session $secondaryBrowser -UserAgent "Ford360-Smoke/1.0 Android Firefox" -Body $credentials
$secondToken = $secondLogin.accessToken
$activeSessions = @(Invoke-Json -Method Get -Path "/auth/sessions" -Session $primaryBrowser -Token $rotatedToken)
if ($activeSessions.Count -lt 2) { throw "O segundo dispositivo não apareceu no painel de sessões." }
$otherSession = $activeSessions | Where-Object { $_.deviceName -like "*Android*" } | Select-Object -First 1
if (-not $otherSession) { throw "Não foi possível identificar a sessão secundária." }

Invoke-Json -Method Delete -Path "/auth/sessions/$($otherSession.id)" -Session $primaryBrowser -Token $rotatedToken | Out-Null
Assert-Unauthorized -Message "O dispositivo secundário continuou autorizado após a revogação." -Request {
  Invoke-Json -Method Get -Path "/auth/me" -Session $secondaryBrowser -Token $secondToken
}

Invoke-Json -Method Post -Path "/auth/logout" -Session $primaryBrowser | Out-Null
Assert-Unauthorized -Message "O token continuou autorizado após o logout." -Request {
  Invoke-Json -Method Get -Path "/auth/me" -Token $rotatedToken
}

Write-Host "OK: cookie HttpOnly, rotação, dois dispositivos, revogação e logout validados."
