param([string]$BaseUrl = "http://127.0.0.1:3000/api/v1")

$ErrorActionPreference = "Stop"
$session = Invoke-RestMethod -Method Post -Uri "$BaseUrl/auth/login" -ContentType "application/json" -Body '{"email":"gerente@ford360.local","password":"Ford@360"}'
$headers = @{ Authorization = "Bearer $($session.accessToken)" }
$checks = [ordered]@{
  health = (Invoke-RestMethod -Uri "$BaseUrl/health").status
  vehicles = (Invoke-RestMethod -Uri "$BaseUrl/vehicles" -Headers $headers).Count
  serviceOrders = (Invoke-RestMethod -Uri "$BaseUrl/service-orders" -Headers $headers).Count
  bookings = (Invoke-RestMethod -Uri "$BaseUrl/bookings" -Headers $headers).Count
  recalls = (Invoke-RestMethod -Uri "$BaseUrl/recalls" -Headers $headers).Count
  repurchaseLeads = (Invoke-RestMethod -Uri "$BaseUrl/repurchase-leads" -Headers $headers).Count
  auditLogs = (Invoke-RestMethod -Uri "$BaseUrl/audit-logs" -Headers $headers).Count
}
$checks | ConvertTo-Json
