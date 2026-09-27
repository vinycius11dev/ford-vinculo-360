param([string]$BaseUrl = "http://127.0.0.1:3000/api/v1")

$ErrorActionPreference = "Stop"
$session = Invoke-RestMethod -Method Post -Uri "$BaseUrl/auth/login" -ContentType "application/json" -Body '{"email":"gerente@ford360.local","password":"Ford@360"}'
$headers = @{ Authorization = "Bearer $($session.accessToken)" }
$dealers = Invoke-RestMethod -Uri "$BaseUrl/dealerships" -Headers $headers
$users = Invoke-RestMethod -Uri "$BaseUrl/users" -Headers $headers
$dealer = $dealers | Where-Object { $_.id -eq "seed-dealer-center-norte" } | Select-Object -First 1
$otherDealer = $dealers | Where-Object { $_.id -ne $dealer.id } | Select-Object -First 1
$customer = $users | Where-Object { $_.role -eq "CUSTOMER" -and $_.ownerships.Count -gt 0 } | Select-Object -First 1

if (-not $dealer -or -not $otherDealer -or -not $customer) {
  throw "Os dados de demonstração necessários para o teste de agenda não foram encontrados."
}

$businessDays = @($dealer.businessDays -split ',') | ForEach-Object { [int]$_ }
$candidate = (Get-Date).Date.AddDays(1)
for ($index = 0; $index -lt 7 -and -not ($businessDays -contains [int]($candidate.DayOfWeek)); $index++) {
  $candidate = $candidate.AddDays(1)
}
if (-not ($businessDays -contains [int]($candidate.DayOfWeek))) {
  throw "Nenhum dia útil foi encontrado nos próximos sete dias."
}
$opening = $dealer.openingTime.Split(":")
$candidate = $candidate.AddHours([int]($opening[0])).AddMinutes([int]($opening[1]) + ([int]($dealer.slotDurationMinutes) * 2))
$vin = $customer.ownerships[0].vehicle.vin
$createdIds = [System.Collections.Generic.List[string]]::new()

function Get-ExpectedFailureStatus {
  param([hashtable]$Body)
  try {
    Invoke-RestMethod -Method Post -Uri "$BaseUrl/bookings" -Headers $headers -ContentType "application/json" -Body ($Body | ConvertTo-Json) | Out-Null
    return 0
  } catch {
    return [int]$_.Exception.Response.StatusCode
  }
}

try {
  for ($index = 1; $index -le [int]($dealer.simultaneousCapacity); $index++) {
    $body = @{
      vin = $vin
      userId = $customer.id
      dealershipId = $dealer.id
      requestedFor = $candidate.ToString("o")
      notes = "Teste de capacidade $index"
    }
    $booking = Invoke-RestMethod -Method Post -Uri "$BaseUrl/bookings" -Headers $headers -ContentType "application/json" -Body ($body | ConvertTo-Json)
    $createdIds.Add($booking.id)
  }

  $fullStatus = Get-ExpectedFailureStatus @{
    vin = $vin
    userId = $customer.id
    dealershipId = $dealer.id
    requestedFor = $candidate.ToString("o")
    notes = "Deve ser rejeitado por lotação"
  }
  $outsideStatus = Get-ExpectedFailureStatus @{
    vin = $vin
    userId = $customer.id
    dealershipId = $dealer.id
    requestedFor = $candidate.Date.AddHours(2).ToString("o")
    notes = "Deve ser rejeitado por expediente"
  }
  $crossDealerStatus = Get-ExpectedFailureStatus @{
    vin = $vin
    userId = $customer.id
    dealershipId = $otherDealer.id
    requestedFor = $candidate.ToString("o")
    notes = "Deve ser rejeitado por isolamento"
  }

  if ($fullStatus -ne 400) { throw "Agenda lotada retornou HTTP $fullStatus, esperado 400." }
  if ($outsideStatus -ne 400) { throw "Fora do expediente retornou HTTP $outsideStatus, esperado 400." }
  if ($crossDealerStatus -ne 403) { throw "Outra concessionária retornou HTTP $crossDealerStatus, esperado 403." }

  [ordered]@{
    acceptedWithinCapacity = $createdIds.Count
    capacityReached = $fullStatus
    outsideHours = $outsideStatus
    crossDealership = $crossDealerStatus
    testedAt = $candidate.ToString("o")
  } | ConvertTo-Json
} finally {
  foreach ($bookingId in $createdIds) {
    Invoke-RestMethod -Method Patch -Uri "$BaseUrl/bookings/$bookingId" -Headers $headers -ContentType "application/json" -Body '{"status":"CANCELLED"}' | Out-Null
  }
}
