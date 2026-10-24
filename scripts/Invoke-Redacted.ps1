<#
.SYNOPSIS
  Run a PowerShell command and print redacted stdout/stderr.

.DESCRIPTION
  Source-side redaction for cases where PostToolUse cannot rewrite output
  (failures fire PostToolUseFailure, which has no updatedToolOutput).
  Uses the plugin's Node redact.js so rules stay in one place.

.PARAMETER Command
  The PowerShell command to run.

.PARAMETER PluginRoot
  Plugin root. Defaults to $env:CLAUDE_PLUGIN_ROOT, then the parent of /scripts.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$Command,

  [string]$PluginRoot = $env:CLAUDE_PLUGIN_ROOT
)

$ErrorActionPreference = 'Continue'

if (-not $PluginRoot) {
  $PluginRoot = Split-Path -Parent $PSScriptRoot
}
$redactJs = Join-Path $PluginRoot 'hooks/scripts/redact.js'
if (-not (Test-Path -LiteralPath $redactJs)) {
  Write-Error "redact.js not found at $redactJs"
  exit 2
}

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  Write-Error 'node is required for redaction (shipped with Claude Code).'
  exit 2
}

$stdoutFile = [System.IO.Path]::GetTempFileName()
$stderrFile = [System.IO.Path]::GetTempFileName()
$exitCode = 0
try {
  try {
    $shellCmd = Get-Command powershell -ErrorAction SilentlyContinue
    if (-not $shellCmd) { $shellCmd = Get-Command pwsh -ErrorAction SilentlyContinue }
    if (-not $shellCmd) { throw "Neither powershell nor pwsh found on PATH" }
    $stdout = & $shellCmd.Source -NoProfile -Command $Command 2> $stderrFile
    if ($null -eq $stdout) { $stdout = @() }
    $stdoutText = ($stdout | Out-String)
    $exitCode = $LASTEXITCODE
    if ($null -eq $exitCode) { $exitCode = 0 }
  } catch {
    $stdoutText = ''
    $_ | Out-String | Set-Content -LiteralPath $stderrFile -Encoding utf8
    $exitCode = 1
  }
  $stderrText = ''
  if (Test-Path -LiteralPath $stderrFile) {
    $stderrText = Get-Content -LiteralPath $stderrFile -Raw -ErrorAction SilentlyContinue
    if ($null -eq $stderrText) { $stderrText = '' }
  }

  $payloadPath = [System.IO.Path]::GetTempFileName()
  @{ stdout = [string]$stdoutText; stderr = [string]$stderrText } |
    ConvertTo-Json -Compress |
    Set-Content -LiteralPath $payloadPath -Encoding utf8

  $runner = @'
const fs = require("fs");
const { redact } = require(process.argv[1]);
const input = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const so = redact(input.stdout || "");
const se = redact(input.stderr || "");
process.stdout.write(so.text);
if (se.text) process.stderr.write(se.text);
'@
  $runnerPath = [System.IO.Path]::GetTempFileName() + '.js'
  Set-Content -LiteralPath $runnerPath -Value $runner -Encoding utf8
  try {
    & node $runnerPath $redactJs $payloadPath
  } finally {
    Remove-Item -LiteralPath $runnerPath, $payloadPath -ErrorAction SilentlyContinue
  }
  exit $exitCode
}
finally {
  Remove-Item -LiteralPath $stdoutFile, $stderrFile -ErrorAction SilentlyContinue
}
