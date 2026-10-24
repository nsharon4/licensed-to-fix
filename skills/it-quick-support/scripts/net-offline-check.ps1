<#
  IT Agent – network check (offline, read-only).
  Runs without Claude and without internet. Reads six network areas, writes one dated report,
  and opens it. Changes nothing on the PC.
  Report: Documents\IT-Agent-Quick\offline\YYYY-MM-DD-HHmm-net.txt
  -OutDir overrides the folder (used for tests). -NoOpen skips opening the report.
#>
param([string]$OutDir = (Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'IT-Agent-Quick\offline'),
      [switch]$NoOpen)
$ErrorActionPreference = 'SilentlyContinue'
$sw = [Diagnostics.Stopwatch]::StartNew()
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$stamp = Get-Date -Format 'yyyy-MM-dd-HHmm'
$file  = Join-Path $OutDir "$stamp-net.txt"
$out   = New-Object System.Collections.Generic.List[string]
$res   = [ordered]@{}
function Add([string]$s){ $out.Add($s) }
function Sec([string]$n){ Add ''; Add "== $n ==" }
function TcpTest([string]$h,[int]$p,[int]$ms=3000){
  try { $c = New-Object Net.Sockets.TcpClient; $a = $c.BeginConnect($h,$p,$null,$null)
        $ok = $a.AsyncWaitHandle.WaitOne($ms) -and $c.Connected; $c.Close(); $ok } catch { $false } }

Add "IT Agent network check (offline, read-only)"
Add ("Time: " + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz'))

# 1. Adapter and link
Sec '1. Adapter and link'
# Physical only: virtual adapters (Hyper-V vEthernet, VPN TAP) stay Up with the cable out or Wi-Fi off.
$up = @(Get-NetAdapter -Physical | Where-Object Status -eq 'Up')
Get-NetAdapter | Select-Object Name, InterfaceDescription, Status, LinkSpeed, MediaConnectionState |
  Format-Table -AutoSize | Out-String -Width 200 | ForEach-Object { Add $_.TrimEnd() }
$wifi = (netsh wlan show interfaces) -match '^\s*(State|SSID|Signal|Radio type)\s*:'
if ($wifi) { Add 'Wi-Fi:'; $wifi | ForEach-Object { Add ('  ' + $_.Trim()) } }
$res.link = $up.Count -gt 0
Add ("RESULT link: " + $(if($res.link){'OK'}else{'FAIL - no adapter is Up (cable, Wi-Fi off, airplane mode)'}))

# 2. IP and gateway
Sec '2. IP and gateway'
$cfg = Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -ne $null -and $_.NetAdapter.Status -eq 'Up' } | Select-Object -First 1
Get-NetIPConfiguration | Where-Object { $_.NetAdapter.Status -eq 'Up' } | ForEach-Object {
  Add ("{0}: IPv4={1} Gateway={2} DNS={3}" -f $_.InterfaceAlias, ($_.IPv4Address.IPAddress -join ','), ($_.IPv4DefaultGateway.NextHop -join ','), ($_.DNSServer.ServerAddresses -join ',')) }
$ip = if ($cfg) { $cfg.IPv4Address.IPAddress | Select-Object -First 1 }
$gw = if ($cfg) { $cfg.IPv4DefaultGateway.NextHop | Select-Object -First 1 }
# A 169.254 adapter has no gateway, so it is never in $cfg: look at the Up physical adapters' own addresses.
$physIdx = @($up | ForEach-Object { $_.ifIndex })
$apipa = -not $cfg -and [bool](Get-NetIPConfiguration | Where-Object { $physIdx -contains $_.InterfaceIndex } |
  ForEach-Object { $_.IPv4Address.IPAddress } | Where-Object { $_ -like '169.254.*' })
$res.ip = [bool]$ip -and -not ($ip -like '169.254.*')
Add ("RESULT ip: " + $(if($res.ip){'OK'}elseif($apipa -or $ip -like '169.254.*'){'FAIL - 169.254 address: no answer from the router (DHCP)'}else{'FAIL - no IPv4 address with a gateway'}))

# 3. Router reach
Sec '3. Router reach'
$res.router = $false
if ($gw) { $p = Test-Connection -ComputerName $gw -Count 2 -ErrorAction SilentlyContinue
  $res.router = [bool]$p; Add ("ping gateway: " + $(if($p){"replied, " + (($p | Measure-Object ResponseTime -Average).Average) + " ms avg"}else{'no reply'})) }
Add ("RESULT router: " + $(if($res.router){'OK'}else{'FAIL - the router does not answer'}))

# 4. Internet reach (by address, no DNS)
Sec '4. Internet reach'
$p1 = Test-Connection -ComputerName 1.1.1.1 -Count 2 -ErrorAction SilentlyContinue
$t1 = TcpTest '1.1.1.1' 443
Add ("ping 1.1.1.1: " + $(if($p1){'replied'}else{'no reply'})); Add ("TCP 1.1.1.1:443: " + $(if($t1){'open'}else{'no connection'}))
$res.internet = [bool]$p1 -or $t1
Add ("RESULT internet: " + $(if($res.internet){'OK'}else{'FAIL - router answers but nothing beyond it (provider or router WAN)'}))

# 5. DNS
Sec '5. DNS'
# Several well-known names: one filtered name (some routers block a domain) must not fail the layer.
$names = 'www.microsoft.com','www.google.com','www.cloudflare.com'
$dl = $false; $dp = $false
foreach ($n in $names) {
  $l = Resolve-DnsName $n -Type A -DnsOnly -QuickTimeout -ErrorAction SilentlyContinue | Where-Object IPAddress | Select-Object -First 1
  $q = Resolve-DnsName $n -Type A -Server 1.1.1.1 -DnsOnly -QuickTimeout -ErrorAction SilentlyContinue | Where-Object IPAddress | Select-Object -First 1
  if ($l) { $dl = $true }; if ($q) { $dp = $true }
  Add ("{0}: local={1} public(1.1.1.1)={2}" -f $n, $(if($l){'answers'}else{'no answer'}), $(if($q){'answers'}else{'no answer'})) }
$res.dns = $dl
Add ("RESULT dns: " + $(if($dl){'OK'}elseif($dp){'FAIL - local DNS fails, public DNS works (DNS setting or router DNS)'}else{'FAIL - no DNS answer'}))

# 6. Proxy and hosts
Sec '6. Proxy and hosts'
$is = Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings'
Add ("User proxy: ProxyEnable=$($is.ProxyEnable) ProxyServer=$($is.ProxyServer) AutoConfigURL=$($is.AutoConfigURL)")
(netsh winhttp show proxy) | Where-Object { $_.Trim() } | ForEach-Object { Add ('WinHTTP: ' + $_.Trim()) }
$h = Join-Path $env:SystemRoot 'System32\drivers\etc\hosts'
$hl = @(Select-String -Path $h -Pattern '^\s*[^#\s]' | ForEach-Object { $_.Line.Trim() })
Add ("hosts active lines: " + $hl.Count + "  (last write " + (Get-Item $h).LastWriteTime.ToString('yyyy-MM-dd HH:mm') + ")"); $hl | Select-Object -First 15 | ForEach-Object { Add ('  ' + $_) }
$res.proxy = -not ($is.ProxyEnable -eq 1 -or $is.AutoConfigURL)
Add ("RESULT proxy: " + $(if($res.proxy){'OK - no user proxy'}else{'CHECK - a proxy is set; unknown proxies break browsing'}))

# Verdict: the first failing layer
$first = @('link','ip','router','internet','dns','proxy') | Where-Object { -not $res[$_] } | Select-Object -First 1
$he = @{ link='אין חיבור לרשת: הכבל מנותק, ה-Wi-Fi כבוי או מצב טיסה.'; ip='המחשב לא קיבל כתובת מהנתב. כדאי לכבות ולהדליק את הנתב.';
         router='הנתב לא עונה. כדאי לבדוק שהנתב דלוק, ולכבות ולהדליק אותו.'; internet='הנתב עונה, אבל אין יציאה לאינטרנט. כנראה תקלה אצל ספק האינטרנט או בנתב.';
         dns='יש אינטרנט, אבל המחשב לא מצליח לתרגם שמות של אתרים (DNS).'; proxy='מוגדר Proxy במחשב, והוא עלול לחסום גלישה.' }
$sw.Stop()
$head = @('', '== VERDICT ==',
  $(if($first){"FIRST FAILING LAYER: $first"}else{'ALL LAYERS OK'}),
  $(if($first){$he[$first]}else{'כל השכבות תקינות. אם אתר מסוים לא נטען, זו כנראה בעיה באתר עצמו או בדפדפן.'}),
  "Run time: $([math]::Round($sw.Elapsed.TotalSeconds,1)) s",
  'כשהחיבור חוזר (או דרך נקודה חמה מהטלפון), כתבו ל-Claude: /it-quick-support אין אינטרנט')
$all = @($out[0], $out[1]) + $head + ($out | Select-Object -Skip 2)
[IO.File]::WriteAllLines($file, [string[]]$all, (New-Object Text.UTF8Encoding $true))
$all | ForEach-Object { Write-Output $_ }
Write-Output ''; Write-Output "Report: $file"
if (-not $NoOpen) { Start-Process notepad.exe -ArgumentList "`"$file`"" }
