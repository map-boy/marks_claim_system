param([string]$Id, [string]$Sql, [string]$Arg, [string]$File, [switch]$List, [switch]$Yes)
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$root = Split-Path $PSScriptRoot -Parent
$cfg = Get-Content (Join-Path $root '.env.local') -Raw | ConvertFrom-StringData
if (-not $cfg.SUPABASE_ACCESS_TOKEN) { throw 'SUPABASE_ACCESS_TOKEN is empty in .env.local' }
$api = "https://api.supabase.com/v1/projects/$($cfg.SUPABASE_PROJECT_REF.Trim())/database/query"
$H = @{ Authorization = "Bearer $($cfg.SUPABASE_ACCESS_TOKEN.Trim())" }

function Get-Blocks([string]$path) {
  $text = Get-Content $path -Raw
  $ms = [regex]::Matches($text, '(?m)^-- \[(\d+\.\d+)\] (.+)$')
  for ($i = 0; $i -lt $ms.Count; $i++) {
    $start = $ms[$i].Index
    $end = if ($i + 1 -lt $ms.Count) { $ms[$i + 1].Index } else { $text.Length }
    [pscustomobject]@{ Id = $ms[$i].Groups[1].Value; Title = $ms[$i].Groups[2].Value.Trim(); Sql = $text.Substring($start, $end - $start) }
  }
}

function Invoke-Q([string]$q) {
  $json = @{ query = $q } | ConvertTo-Json -Compress
  try { Invoke-RestMethod $api -Method Post -Headers $H -ContentType 'application/json' -Body ([Text.Encoding]::UTF8.GetBytes($json)) }
  catch {
    $r = $_.Exception.Response
    if ($r) { Write-Host ((New-Object IO.StreamReader($r.GetResponseStream())).ReadToEnd()) -ForegroundColor Red }
    else { Write-Host $_.Exception.Message -ForegroundColor Red }
    return $null
  }
}

$qfile = Join-Path $PSScriptRoot 'queries.sql'
if ($List) { Get-Blocks $qfile | Format-Table Id, Title -AutoSize | Out-String | Write-Host; return }

if ($Sql) { $q = $Sql }
elseif ($File) { $q = Get-Content $File -Raw }
elseif ($Id) {
  $b = Get-Blocks $qfile | Where-Object { $_.Id -eq $Id }
  if (-not $b) { throw "No query with id $Id. Use -List to see them." }
  $q = $b.Sql
}
else { Write-Host 'Usage: -List | -Id 3.2 [-Arg value] | -Sql "select ..." | -File path   (add -Yes to skip the confirm on changes)'; return }

if ($q -match '\{\{arg\}\}') {
  if (-not $Arg) { throw 'This query needs -Arg "value"' }
  $q = $q.Replace('{{arg}}', $Arg.Replace("'", "''"))
}

$plain = [regex]::Replace($q, '(?m)--.*$', '')
if (($plain -match '(?i)\b(delete|update|insert|drop|truncate|alter|create)\b') -and -not $Yes) {
  Write-Host $q -ForegroundColor Yellow
  if ((Read-Host 'This CHANGES data. Type yes to run') -ne 'yes') { Write-Host 'cancelled'; return }
}

$res = Invoke-Q $q
if ($null -eq $res) { return }
if (@($res).Count -eq 0) { Write-Host '(0 rows)' }
else { $res | Format-Table -AutoSize | Out-String -Width 4096 | Write-Host }