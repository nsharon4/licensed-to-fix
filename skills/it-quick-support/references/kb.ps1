# kb.ps1 - local knowledge base of solved tickets for it-quick-support (simple local retrieval, no embeddings).
# Add:    & kb.ps1 -Add -Ticket IT-0009 -Category "hardware > camera" -Symptom "..." -Checks "..." -Cause "..." -Fix "..." -Worked yes|no|partial -Tags "meet,camera,privacy"
# Search: & kb.ps1 -Search "camera black in meet" [-Top 5]
param(
  [switch]$Add, [string]$Search = '', [int]$Top = 5,
  [string]$Ticket = '', [string]$Category = '', [string]$Symptom = '', [string]$Checks = '',
  [string]$Cause = '', [string]$Fix = '', [string]$Worked = '', [string]$Tags = '',
  [string]$Root = (Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'IT-Agent-Quick')
)
$dir = Join-Path $Root 'Knowledge'; New-Item -ItemType Directory -Force -Path $dir | Out-Null
$kb = Join-Path $dir 'knowledge.jsonl'; $MaxBytes = 2MB; $enc = New-Object Text.UTF8Encoding $false
function Clean([string]$s, [int]$max) {
  if (-not $s) { return '' }
  $s = $s -replace '(?i)(api[_-]?key|token|secret|password|passwd|pwd|authorization|bearer)\s*[:=]\s*\S+', '$1=<hidden>'
  $s = $s -replace 'sk-[A-Za-z0-9_\-]{10,}', '<hidden>' -replace 'AIza[0-9A-Za-z_\-]{20,}', '<hidden>' -replace '[\r\n]+', ' '
  if ($s.Length -gt $max) { $s = $s.Substring(0, $max) + '...' }; return $s
}
$Stop = @('אין','לא','של','את','על','עם','זה','גם','יש','כל','או','אני','לי','הוא','היא','מה','כי','אם','רק','עוד','the','and','not','no','is','in','on','of','to','a','an','for','with','it','my')
function Words([string]$s) { ($s.ToLower() -split '[^\p{L}\p{N}]+') | Where-Object { $_.Length -ge 2 -and $Stop -notcontains $_ } | Select-Object -Unique }
$rows = @(); if (Test-Path $kb) { $rows = @(Get-Content $kb -Encoding UTF8 | Where-Object { $_ } | ForEach-Object { try { $_ | ConvertFrom-Json } catch {} }) }
if ($Add) {
  $e = [ordered]@{ time = (Get-Date).ToString('s'); ticket = $Ticket; category = (Clean $Category 80); symptom = (Clean $Symptom 300);
    checks = (Clean $Checks 400); cause = (Clean $Cause 300); fix = (Clean $Fix 400); worked = $Worked; tags = (Clean $Tags 120); seen = 1 }
  # Same category and cause again: bump the counter and keep the newest wording instead of a new line.
  $dup = $rows | Where-Object { $_.category -eq $e.category -and $_.cause -eq $e.cause } | Select-Object -First 1
  if ($dup) { $dup.seen = [int]$dup.seen + 1; $dup.time = $e.time; $dup.ticket = $Ticket; $dup.fix = $e.fix; $dup.worked = $Worked }
  else { $rows += [pscustomobject]$e }
  $lines = @($rows | ForEach-Object { $_ | ConvertTo-Json -Compress })
  # Size cap: drop the oldest rows seen only once until under 2 MB.
  while (($enc.GetByteCount(($lines -join "`n"))) -gt $MaxBytes -and $lines.Count -gt 1) {
    $i = 0; for ($j = 0; $j -lt $rows.Count; $j++) { if ([int]$rows[$j].seen -le 1) { $i = $j; break } }
    $rows = @($rows | Select-Object -Index (@(0..($rows.Count-1)) | Where-Object { $_ -ne $i })); $lines = @($rows | ForEach-Object { $_ | ConvertTo-Json -Compress })
  }
  [IO.File]::WriteAllText($kb, (($lines -join "`n") + "`n"), $enc); "saved ($($rows.Count) entries)"; return
}
if ($Search) {
  $q = Words $Search; if (-not $rows.Count) { 'no knowledge yet'; return }
  $rows | ForEach-Object {
    $w = Words "$($_.category) $($_.symptom) $($_.tags) $($_.cause)"
    $hit = @($q | Where-Object { $w -contains $_ }).Count
    $bonus = if ($_.worked -eq 'yes') { 0.5 } else { 0 }
    [pscustomobject]@{ score = $hit + $bonus + [Math]::Min([int]$_.seen, 5) * 0.1; row = $_ }
  } | Where-Object { $_.score -ge 1 } | Sort-Object score -Descending | Select-Object -First $Top | ForEach-Object { $_.row | ConvertTo-Json -Compress }
}