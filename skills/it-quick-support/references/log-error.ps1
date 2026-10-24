# log-error.ps1 - append one error line to the it-quick-support error log, with size cap and rotation.
# Usage: & "<skill>\references\log-error.ps1" -Ticket IT-0009 -Stage publish -Kind gate-fail -Message "auto-jump target missing" [-Command "..."] [-Root <IT-Agent-Quick folder>]
param(
  [string]$Ticket = '', [string]$Stage = '', [string]$Kind = 'error',
  [Parameter(Mandatory=$true)][string]$Message, [string]$Command = '',
  [string]$Root = (Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'IT-Agent-Quick')
)
$MaxBytes = 512KB; $Keep = 2; $MaxDays = 30
$dir = Join-Path $Root 'Logs'; New-Item -ItemType Directory -Force -Path $dir | Out-Null
$log = Join-Path $dir 'agent-errors.jsonl'
function Clean([string]$s, [int]$max) {
  if (-not $s) { return '' }
  $s = $s -replace '(?i)(api[_-]?key|token|secret|password|passwd|pwd|authorization|bearer)\s*[:=]\s*\S+', '$1=<hidden>'
  $s = $s -replace 'sk-[A-Za-z0-9_\-]{10,}', '<hidden>' -replace 'AIza[0-9A-Za-z_\-]{20,}', '<hidden>'
  $s = $s -replace '[\r\n]+', ' '
  if ($s.Length -gt $max) { $s = $s.Substring(0, $max) + '...' }
  return $s
}
$msg = Clean $Message 500; $cmd = Clean $Command 200
$sig = "$Ticket|$Stage|$Kind|$msg"
# Same error again in the same ticket: bump the counter on the last line instead of adding a line.
if (Test-Path $log) {
  $last = Get-Content $log -Tail 1 -Encoding UTF8
  if ($last) { try { $o = $last | ConvertFrom-Json
    if ("$($o.ticket)|$($o.stage)|$($o.kind)|$($o.msg)" -eq $sig) {
      $o.count = [int]$o.count + 1; $o.last = (Get-Date).ToString('s')
      $all = [IO.File]::ReadAllLines($log, [Text.Encoding]::UTF8); $all[-1] = ($o | ConvertTo-Json -Compress)
      [IO.File]::WriteAllLines($log, $all, (New-Object Text.UTF8Encoding $false)); return } } catch {} }
}
# Rotate when over the cap: agent-errors.jsonl -> .1 -> .2, oldest dropped. Total stays under ~1.5 MB.
if ((Test-Path $log) -and (Get-Item $log).Length -ge $MaxBytes) {
  for ($i = $Keep; $i -ge 1; $i--) {
    $src = if ($i -eq 1) { $log } else { "$log.$($i-1)" }; $dst = "$log.$i"
    if (Test-Path $src) { Move-Item -Force $src $dst }
  }
}
Get-ChildItem $dir -Filter 'agent-errors.jsonl.*' | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$MaxDays) } | Remove-Item -Force
$now = (Get-Date).ToString('s')
$line = [ordered]@{ time = $now; last = $now; count = 1; ticket = $Ticket; stage = $Stage; kind = $Kind; msg = $msg; cmd = $cmd } | ConvertTo-Json -Compress
[IO.File]::AppendAllText($log, $line + "`n", (New-Object Text.UTF8Encoding $false))