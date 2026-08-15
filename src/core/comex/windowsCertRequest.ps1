#Requires -Version 5.1
<#
.SYNOPSIS
  HTTPS com certificado do Windows CurrentUser\My (A1 não exportável).
.DESCRIPTION
  Usado pelo PucomexClient Node quando PUCOMEX_CERT_THUMBPRINT está definido.
  Entrada JSON via stdin: { thumbprint, method, url, headers, body }
  Saída JSON stdout: { status, headers, bodyText }
#>
$ErrorActionPreference = 'Stop'
$inputJson = [Console]::In.ReadToEnd()
if ([string]::IsNullOrWhiteSpace($inputJson)) {
  Write-Output (@{ status = 500; headers = @{}; bodyText = '{"error":"stdin vazio"}' } | ConvertTo-Json -Compress)
  exit 1
}

$req = $inputJson | ConvertFrom-Json
$thumb = ($req.thumbprint -replace '\s', '').ToUpperInvariant()
$method = if ($req.method) { $req.method.ToUpperInvariant() } else { 'GET' }
$url = [string]$req.url
$headers = @{}
if ($req.headers) {
  $req.headers.PSObject.Properties | ForEach-Object { $headers[$_.Name] = [string]$_.Value }
}
$body = $null
if ($null -ne $req.body -and $req.body -ne '') { $body = [string]$req.body }

$cert = Get-ChildItem Cert:\CurrentUser\My | Where-Object { $_.Thumbprint -eq $thumb } | Select-Object -First 1
if (-not $cert) {
  $payload = @{
    status   = 503
    headers  = @{}
    bodyText = (@{ message = "Certificado $thumb não encontrado em CurrentUser\My"; code = 'PUCOMEX_CERT_NOT_FOUND' } | ConvertTo-Json -Compress)
  }
  Write-Output ($payload | ConvertTo-Json -Compress -Depth 6)
  exit 0
}

try {
  $params = @{
    Uri             = $url
    Method          = $method
    Certificate     = $cert
    Headers         = $headers
    UseBasicParsing = $true
  }
  if ($body) {
    $params.Body = $body
    if (-not $headers.ContainsKey('Content-Type')) {
      $params.ContentType = 'application/json; charset=utf-8'
    }
  }

  $resp = Invoke-WebRequest @params
  $outHeaders = @{}
  foreach ($k in $resp.Headers.Keys) {
    $outHeaders[$k] = [string]$resp.Headers[$k]
  }
  $payload = @{
    status   = [int]$resp.StatusCode
    headers  = $outHeaders
    bodyText = [string]$resp.Content
  }
  Write-Output ($payload | ConvertTo-Json -Compress -Depth 8)
}
catch {
  $status = 500
  $bodyText = $_.Exception.Message
  if ($_.Exception.Response) {
    try {
      $status = [int]$_.Exception.Response.StatusCode
      $stream = $_.Exception.Response.GetResponseStream()
      if ($stream) {
        $reader = New-Object System.IO.StreamReader($stream)
        $bodyText = $reader.ReadToEnd()
        $reader.Close()
      }
    }
    catch { }
  }
  $payload = @{
    status   = $status
    headers  = @{}
    bodyText = $bodyText
  }
  Write-Output ($payload | ConvertTo-Json -Compress -Depth 6)
}
