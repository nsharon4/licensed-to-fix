# Windows checks for quick support

Every command in this file is read-only unless it's marked **CHANGE**. Run read-only checks with a timeout or a count. Some reads need admin rights. When one fails with access denied, say so in one line in the person's language, carry on without it, and don't elevate just to read unless the cause can't be found any other way. Elevating to read is still an action: ask first.

Contents: [Triage per area](#triage-per-area) · [Cause hunt](#cause-hunt-what-changed-it) · [Elevation](#elevation) · [Verify and recurrence](#verify-and-recurrence)

## Triage per area

### Network / "the internet doesn't work"
First read any offline report from the last 24 hours in `Documents\IT-Agent-Quick\offline\` (SKILL.md section 2a). It shows the state while the connection was dead.
Test DNS with several well-known names, never one: one domain can be blocked at the router's DNS or at the provider behind it (on a working network the router's DNS answered that example.com does not exist, while a public DNS and three other names resolved).
Judge the link by physical adapters only: virtual ones (Hyper-V vEthernet, VPN TAP) stay Up with the cable out or Wi-Fi off.
```powershell
Get-NetAdapter -Physical | Where-Object Status -eq 'Up' | Select-Object Name, InterfaceDescription, LinkSpeed | Format-Table -AutoSize -Wrap
Get-NetIPConfiguration | Select-Object InterfaceAlias, IPv4Address, IPv4DefaultGateway, DNSServer | Format-Table -AutoSize -Wrap
Test-Connection -ComputerName 1.1.1.1 -Count 2 -ErrorAction SilentlyContinue | Select-Object Address, ResponseTime | Format-Table -AutoSize -Wrap
'www.microsoft.com','www.google.com','www.cloudflare.com' | ForEach-Object { Resolve-DnsName $_ -Type A -DnsOnly -QuickTimeout -ErrorAction SilentlyContinue | Select-Object -First 1 Name, IPAddress } | Format-Table -AutoSize -Wrap
Test-NetConnection www.microsoft.com -Port 443 -InformationLevel Quiet
```
Narrow: if all of these pass but one site fails, check that site by name (next block). Gateway ping slow but internet fine is usually Wi-Fi quality, not the complaint.

### One site or app doesn't load (hosts, DNS, proxy)
```powershell
$site = 'he.wikipedia.org'   # the site the person named
Resolve-DnsName $site -ErrorAction SilentlyContinue | Select-Object Name, IPAddress | Format-Table -AutoSize -Wrap   # through the PC (includes hosts)
Resolve-DnsName $site -Server 1.1.1.1 -DnsOnly -ErrorAction SilentlyContinue | Select-Object Name, IPAddress | Format-Table -AutoSize -Wrap   # public reference
$h = "$env:SystemRoot\System32\drivers\etc\hosts"
Select-String -Path $h -Pattern '^\s*[^#\s]' | Select-Object LineNumber, Line | Format-Table -AutoSize -Wrap
(Get-Item $h).LastWriteTime
Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings' | Select-Object ProxyEnable, ProxyServer, ProxyOverride, AutoConfigURL | Format-Table -AutoSize -Wrap
netsh winhttp show proxy
Get-DnsClientNrptPolicy -ErrorAction SilentlyContinue
Test-NetConnection $site -Port 443 | Select-Object RemoteAddress, TcpTestSucceeded | Format-Table -AutoSize -Wrap
```
A local answer of 127.0.0.1 / 0.0.0.0 vs a real public answer means hosts or a local filter. An unknown ProxyServer or AutoConfigURL means a proxy. Then go to the cause hunt, because a hosts entry or proxy someone wrote can be written again.

### Printing
```powershell
Get-Service Spooler | Select-Object Status, StartType | Format-Table -AutoSize -Wrap
Get-CimInstance Win32_Service -Filter "Name='Spooler'" | Select-Object State, StartMode, ExitCode | Format-Table -AutoSize -Wrap
Get-Printer -ErrorAction SilentlyContinue | Select-Object Name, PrinterStatus, PortName, Default | Format-Table -AutoSize -Wrap
$def = Get-Printer -ErrorAction SilentlyContinue | Where-Object Default
if ($def) { Get-PrintJob -PrinterName $def.Name -ErrorAction SilentlyContinue | Format-Table -AutoSize -Wrap } else { 'no default printer' }
Get-PnpDevice -Class Printer -ErrorAction SilentlyContinue | Select-Object FriendlyName, Status | Format-Table -AutoSize -Wrap
```
Get-Printer fails or returns nothing while Spooler is stopped. Fix the service question first.

### Sound
```powershell
Get-Service Audiosrv, AudioEndpointBuilder | Select-Object Name, Status, StartType | Format-Table -AutoSize -Wrap
Get-PnpDevice -Class AudioEndpoint, MEDIA -ErrorAction SilentlyContinue | Select-Object FriendlyName, Status | Format-Table -AutoSize -Wrap
```

### Any service or app that "stopped working"
```powershell
$svc = 'Spooler'   # the service in question
Get-CimInstance Win32_Service -Filter "Name='$svc'" | Select-Object Name, State, StartMode, ExitCode, PathName, StartName | Format-Table -AutoSize -Wrap
Get-CimInstance Win32_Service | Where-Object { $_.StartMode -eq 'Auto' -and $_.State -ne 'Running' -and $_.ExitCode -ne 0 } | Select-Object Name, State, ExitCode | Format-Table -AutoSize -Wrap
```
An automatic service that is stopped with exit code 0 is usually a trigger-start or updater service, not a fault.

### Disk full / slow PC
```powershell
Get-Volume | Where-Object DriveType -eq 'Fixed' | Select-Object DriveLetter, @{n='FreeGB';e={[math]::Round($_.SizeRemaining/1GB,1)}}, @{n='SizeGB';e={[math]::Round($_.Size/1GB,1)}} | Format-Table -AutoSize -Wrap
Get-PhysicalDisk | Select-Object FriendlyName, MediaType, HealthStatus | Format-Table -AutoSize -Wrap
Get-Process | Sort-Object CPU -Descending | Select-Object -First 8 Name, CPU, @{n='MemMB';e={[math]::Round($_.WorkingSet64/1MB)}} | Format-Table -AutoSize -Wrap
Get-CimInstance Win32_OperatingSystem | Select-Object LastBootUpTime, FreePhysicalMemory, TotalVisibleMemorySize | Format-Table -AutoSize -Wrap
```

### Recent errors (last 24 hours only)
```powershell
Get-WinEvent -FilterHashtable @{LogName='System','Application'; Level=1,2; StartTime=(Get-Date).AddHours(-24)} -MaxEvents 200 -ErrorAction SilentlyContinue |
  Group-Object ProviderName | Sort-Object Count -Descending | Select-Object -First 10 Count, Name | Format-Table -AutoSize -Wrap
```

### Windows Update restarts in the middle of work
```powershell
Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\WindowsUpdate\UX\Settings' -ErrorAction SilentlyContinue | Select-Object ActiveHoursStart, ActiveHoursEnd | Format-Table -AutoSize -Wrap
[pscustomobject]@{
  WU_RebootRequired = Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired'
  CBS_RebootPending = Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending' }
# 1074 = who asked for the restart (process, reason). TrustedInstaller with "Operating System: Upgrade" = an update restart.
Get-WinEvent -FilterHashtable @{LogName='System'; Id=1074; StartTime=(Get-Date).AddDays(-14)} -MaxEvents 5 -ErrorAction SilentlyContinue |
  Select-Object TimeCreated, @{n='Process';e={($_.Properties[0].Value -split '\\')[-1]}}, @{n='Reason';e={$_.Properties[2].Value}} | Format-Table -AutoSize -Wrap
Get-HotFix | Sort-Object InstalledOn -Descending | Select-Object -First 3 HotFixID, InstalledOn | Format-Table -AutoSize -Wrap
```
The restart the person complains about is the event itself, so read 14 days here, not 24 hours. Compare the 1074 times with the Active Hours. The fix is a CHANGE (Active Hours to the working day, or a scheduled restart time); never disable Windows Update.

### Slow boot
```powershell
Get-CimInstance Win32_OperatingSystem | Select-Object LastBootUpTime | Format-Table -AutoSize -Wrap
Get-CimInstance Win32_StartupCommand | Select-Object Name, Command, Location | Format-Table -AutoSize -Wrap
Get-ScheduledTask | Where-Object { $_.State -ne 'Disabled' -and $_.TaskPath -notlike '\Microsoft\*' -and
  ($_.Triggers | Where-Object { $_.CimClass.CimClassName -match 'Logon|Boot' }) } | Select-Object TaskName, TaskPath | Format-Table -AutoSize -Wrap
```
Boot-time events (Diagnostics-Performance log, event 100) need admin: without it the read fails with "unauthorized". Win32_StartupCommand also lists other accounts' Run keys; judge only the current user's and HKLM. Disable startup items one at a time, each with its own action ID.

### Disk stuck at 100%
```powershell
(Get-Counter '\PhysicalDisk(_Total)\% Idle Time' -SampleInterval 1 -MaxSamples 5).CounterSamples | ForEach-Object { [math]::Round(100 - $_.CookedValue, 1) }   # busy %
(Get-Counter '\Process(*)\IO Data Bytes/sec' -ErrorAction SilentlyContinue).CounterSamples |
  Where-Object { $_.InstanceName -notin '_total','idle' } | Sort-Object CookedValue -Descending |
  Select-Object -First 5 InstanceName, @{n='MBps';e={[math]::Round($_.CookedValue/1MB,2)}} | Format-Table -AutoSize -Wrap
Get-Service WSearch, SysMain -ErrorAction SilentlyContinue | Select-Object Name, Status, StartType | Format-Table -AutoSize -Wrap
Get-PhysicalDisk | Select-Object FriendlyName, MediaType, HealthStatus | Format-Table -AutoSize -Wrap
```
Use the counters, not Win32_PerfFormattedData_PerfProc_Process (it took 20+ seconds in tests). Busy % near 100 for several samples plus one process on top names the culprit. HealthStatus not Healthy is a disk fault: say so and recommend a backup, not a tweak.

### Bluetooth gone or not working
```powershell
Get-PnpDevice -Class Bluetooth -ErrorAction SilentlyContinue | Select-Object FriendlyName, Status, Problem | Format-Table -AutoSize -Wrap
Get-Service bthserv -ErrorAction SilentlyContinue | Select-Object Name, Status, StartType | Format-Table -AutoSize -Wrap
Get-PnpDevice -Class Bluetooth -PresentOnly | Where-Object FriendlyName -match 'Adapter|Radio|Wireless|Intel|Realtek|Qualcomm|MediaTek' |
  Get-PnpDeviceProperty DEVPKEY_Device_DriverVersion, DEVPKEY_Device_DriverDate -ErrorAction SilentlyContinue | Select-Object KeyName, Data | Format-Table -AutoSize -Wrap
```
A Problem code other than CM_PROB_NONE, or Status Error, points at the adapter or its driver. No adapter at all (only paired devices, or nothing) means a disabled radio, airplane mode, or hardware: check Get-PnpDevice without -PresentOnly for a hidden adapter before saying hardware.

### Windows Search finds nothing
```powershell
Get-Service WSearch | Select-Object Name, Status, StartType | Format-Table -AutoSize -Wrap
Get-WinEvent -FilterHashtable @{LogName='Application'; ProviderName='Microsoft-Windows-Search'; Level=1,2; StartTime=(Get-Date).AddHours(-24)} -MaxEvents 10 -ErrorAction SilentlyContinue |
  Select-Object TimeCreated, Id, @{n='Msg';e={($_.Message -split "`n")[0]}} | Format-Table -AutoSize -Wrap
# Does the index answer? A known file name should return rows.
$c = New-Object -ComObject ADODB.Connection; $c.Open("Provider=Search.CollatorDSO;Extended Properties='Application=Windows';")
$r = $c.Execute("SELECT TOP 3 System.ItemName FROM SystemIndex WHERE System.FileName LIKE 'desktop%'"); $n = 0; while (-not $r.EOF) { $n++; $r.MoveNext() }; "index rows: $n"; $c.Close()
```
The index query is also the verify step after a fix: rerun it with a file the person knows exists. Rebuilding the index is a CHANGE and takes a long time on a full disk: say so before asking.

### Blue screen after an update
```powershell
# BugCheck records (one per crash) and unexpected shutdowns, last 30 days.
Get-WinEvent -FilterHashtable @{LogName='System'; ProviderName='Microsoft-Windows-WER-SystemErrorReporting'; Id=1001; StartTime=(Get-Date).AddDays(-30)} -MaxEvents 10 -ErrorAction SilentlyContinue |
  Select-Object TimeCreated, @{n='Msg';e={($_.Message -split "`n")[0]}} | Format-Table -AutoSize -Wrap
Get-WinEvent -FilterHashtable @{LogName='System'; ProviderName='Microsoft-Windows-Kernel-Power'; Id=41; StartTime=(Get-Date).AddDays(-30)} -MaxEvents 10 -ErrorAction SilentlyContinue | Select-Object TimeCreated | Format-Table -AutoSize -Wrap
Get-HotFix | Where-Object InstalledOn -gt (Get-Date).AddDays(-30) | Select-Object HotFixID, InstalledOn | Format-Table -AutoSize -Wrap
```
The crash is the complaint, so 30 days is allowed here. Kernel-Power 41 alone means an unexpected shutdown (power loss, a hard reset), not proof of a blue screen. The Minidump folder needs admin to list. Match crash times to install dates; a crash that starts right after one update points at it or at a driver it changed. Uninstalling an update or rolling back a driver is a CHANGE: offer a restore point first.

### Security investigation (mandatory for every security complaint; read-only)
Never stop at "the alert is gone" or "the scan is clean". Run every step, write each one as its own step line on the page, and end with "מי הריץ: <session/app/user/task>" and the confidence.
```powershell
# 1. The alert itself: what was detected, when, which file/process (Defender; for Bitdefender read its event in the Application log and the alert text from the person)
Get-MpThreatDetection | sort InitialDetectionTime -desc | select -First 10 InitialDetectionTime,ThreatID,ProcessName,DomainUser,Resources,ActionSuccess
Get-WinEvent -FilterHashtable @{LogName='Application';StartTime=(Get-Date).AddHours(-24)} | ? {$_.ProviderName -match 'Bitdefender|Defender|Security'} | select -First 20 TimeCreated,ProviderName,Id,Message
# 2. Process tree: the suspicious process, its full command line and every parent up to the root
$all = Get-CimInstance Win32_Process
function Up($id){ while($id){ $p=$all|?{$_.ProcessId -eq $id}; if(-not $p){break}; [pscustomobject]@{PID=$p.ProcessId;Parent=$p.ParentProcessId;Name=$p.Name;Start=$p.CreationDate;Cmd=$p.CommandLine}; $id=$p.ParentProcessId } }
$all | ? { $_.Name -match 'powershell|pwsh|cmd|wscript|cscript|python|node|mshta|rundll32' } | select ProcessId,ParentProcessId,Name,CreationDate,CommandLine
# Up <PID>   # run for each suspicious PID
# 3. What the script did: PowerShell script-block log around the alert time (4104), and the script file (path, hash, owner, times)
Get-WinEvent -FilterHashtable @{LogName='Microsoft-Windows-PowerShell/Operational';Id=4104;StartTime=(Get-Date).AddHours(-2)} -MaxEvents 50 | select TimeCreated,@{n='Text';e={$_.Message.Substring(0,[Math]::Min(300,$_.Message.Length))}}
# Get-FileHash <path>; Get-Item <path> | select FullName,CreationTime,LastWriteTime; (Get-Acl <path>).Owner
# 4. Who launched it: scheduled tasks, Run keys and services that point at that path or script name
Get-ScheduledTask | ? { ($_.Actions.Execute + ' ' + $_.Actions.Arguments) -match '<script-or-folder>' }
# 5. AI/automation source: match the script name (e.g. ps-script-*.ps1) and alert time against Claude session transcripts and other agents' logs
Get-ChildItem "$env:USERPROFILE\.claude\projects" -Recurse -Filter *.jsonl | ? { $_.LastWriteTime -gt (Get-Date).AddHours(-3) } | Select-String -Pattern '<script-name-or-path>' -List | select Path,LineNumber
# 6. Network: open connections of the suspicious PID
Get-NetTCPConnection -OwningProcess <PID> -ErrorAction SilentlyContinue | select LocalPort,RemoteAddress,RemotePort,State
```
Report on the page: the file, the command line, the parent chain, the session/app/user that ran it, whether it still runs, and the recommendation (stop / remove / allow), each with approve/reject. Never stop, delete, quarantine or add an exclusion without approval.

#### Mandatory: match every AV alert to its process (Bitdefender)
- Time range (approved, hard limit): only alerts from the start of the ticket day plus the 7 full days before the ticket was opened. Never look further back (no month, no year, no "all history"), even if the database holds older events; filter by timestamp in the query itself, not after reading everything. Match each alert in that range; report how many alerts were in range and whether the same detection repeats (pattern). Older alerts are only counted and listed as "לא נבדק (מחוץ לטווח 7 ימים)", never investigated.
- Read Bitdefender's own alert store read-only: copy `C:\Program Files\Bitdefender\Bitdefender Security App\events\events.db` to %TEMP% and query the copy with Python sqlite3 (table `events`: source, timestamp, type, bin_data). Never open the live file for writing. Also read the alert list in the Bitdefender app (Notifications) for detection name and time when the database can't be decoded, and say which source was used.
- For each alert (detection name + time): find the PowerShell/process that ran within ±1 minute (4104/4100 events, Win32_Process start times, ps-script file creation times) and its parent chain to the app or agent that launched it. Write one line per alert: "התראה <שם> <שעה> ← <תהליך/סקריפט> ← <מי הריץ> · ודאות: ודאי/סביר/לא אומת".
- Also run Get-NetTCPConnection for the involved processes (and whenever secrets were found) and record whether any outside connection existed.
- An alert that could not be matched goes under "לא נבדק" / "לא אומת"; never fill the gap with a general statement such as "all processes were launched by X".

## Cause hunt: what changed it

Use this when the cause is a state that something changed. Goal: the time of the change, then the thing that made it.

### 1. When did it change?
```powershell
# Service start-type changes (7040) and stop/start (7036) for one service, last 24 h
$svc = 'Print Spooler'   # display name, as it appears in event text
Get-WinEvent -FilterHashtable @{LogName='System'; ProviderName='Service Control Manager'; Id=7040,7036; StartTime=(Get-Date).AddHours(-24)} -MaxEvents 300 -ErrorAction SilentlyContinue |
  Where-Object Message -match $svc | Select-Object -First 15 TimeCreated, Id, Message | Format-Table -AutoSize -Wrap
```
A repeating pattern (stopped every minute, or start type changed again and again) means something on a schedule.

### 2. Scheduled tasks that touch it (read the action, not the name)
```powershell
$pattern = 'Spooler|sc(\.exe)?\s+(stop|config)|Stop-Service|Set-Service|hosts|netsh|ProxyServer|reg(\.exe)?\s+add|-enc|EncodedCommand'
Get-ScheduledTask -ErrorAction SilentlyContinue | ForEach-Object {
  $t = $_
  foreach ($a in $t.Actions) {
    $line = "$($a.Execute) $($a.Arguments)"
    if ($line -match $pattern) {
      $info = $t | Get-ScheduledTaskInfo -ErrorAction SilentlyContinue
      [pscustomobject]@{ Task = "$($t.TaskPath)$($t.TaskName)"; State = $t.State; Author = $t.Author; Registered = $t.Date
                         LastRun = $info.LastRunTime; NextRun = $info.NextRunTime; Action = $line }
    }
  }
} | Format-List
```
Then read the suspect's triggers and its repeat interval:
```powershell
$t = Get-ScheduledTask -TaskName 'NAME' -TaskPath '\PATH\'
$t.Triggers | Select-Object @{n='Type';e={$_.CimClass.CimClassName}}, StartBoundary, Enabled, @{n='Repeat';e={$_.Repetition.Interval}} | Format-Table -AutoSize -Wrap
$t.Principal | Select-Object UserId, RunLevel | Format-Table -AutoSize -Wrap
```
- Also list recently registered tasks outside `\Microsoft\`. A task registered today is a strong lead:
  `Get-ScheduledTask | Where-Object { $_.TaskPath -notlike '\Microsoft\*' } | Select-Object TaskPath, TaskName, State, Date, Author`
- If the action runs a script file, read the file (Get-Content). Never run it. An `-EncodedCommand` argument can be decoded for reading only: `[Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('...'))`.
- A task you can't read without admin is itself a finding. Say so.
- The Task Scheduler history log (Microsoft-Windows-TaskScheduler/Operational) is often disabled. Don't rely on it.

### 3. Policies
```powershell
gpresult /r /scope user 2>$null | Select-String -Pattern 'Applied Group Policy Objects' -Context 0,6
Get-ChildItem 'HKLM:\SOFTWARE\Policies', 'HKCU:\SOFTWARE\Policies' -Recurse -ErrorAction SilentlyContinue |
  Where-Object Name -match 'Printers|Internet Settings|DNSClient|WindowsFirewall|NetworkConnections' | Select-Object Name | Format-Table -AutoSize -Wrap
Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Services\Spooler' | Select-Object Start | Format-Table -AutoSize -Wrap   # 2=Auto 3=Manual 4=Disabled
```
A domain or MDM policy is a legitimate owner. Recommend talking to whoever manages the PC; don't override it.

### 4. Startup and logon
```powershell
Get-CimInstance Win32_StartupCommand | Select-Object Name, Command, Location, User | Format-Table -AutoSize -Wrap
'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run','HKLM:\Software\Microsoft\Windows\CurrentVersion\Run',
'HKCU:\Software\Microsoft\Windows\CurrentVersion\RunOnce','HKLM:\Software\Microsoft\Windows\CurrentVersion\RunOnce' |
  ForEach-Object { Get-ItemProperty $_ -ErrorAction SilentlyContinue }
Get-ChildItem "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup", "$env:ProgramData\Microsoft\Windows\Start Menu\Programs\StartUp" -ErrorAction SilentlyContinue
```
Admin only, optional: WMI permanent subscriptions (`Get-CimInstance -Namespace root/subscription -ClassName __FilterToConsumerBinding`).

### 5. Recent installs and changes around that time
```powershell
$since = (Get-Date).AddDays(-2)
Get-WinEvent -FilterHashtable @{LogName='Application'; ProviderName='MsiInstaller'; StartTime=$since} -MaxEvents 20 -ErrorAction SilentlyContinue | Select-Object TimeCreated, Message | Format-Table -AutoSize -Wrap
Get-HotFix | Sort-Object InstalledOn -Descending | Select-Object -First 5 HotFixID, InstalledOn | Format-Table -AutoSize -Wrap
Get-ChildItem 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall','HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall','HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall' -ErrorAction SilentlyContinue |
  Get-ItemProperty | Where-Object InstallDate -ge $since.ToString('yyyyMMdd') | Select-Object DisplayName, InstallDate, Publisher | Format-Table -AutoSize -Wrap
```

### Typical fix pairs (each is a CHANGE, so each gets its own action ID)
| Origin found | First (origin) | Then (state) | Undo |
|---|---|---|---|
| Task disables a service | `Export-ScheduledTask -TaskName N -TaskPath P \| Out-File task-backup.xml` (read) then `Disable-ScheduledTask -TaskName N -TaskPath P` | `Set-Service Spooler -StartupType Automatic; Start-Service Spooler` | `Enable-ScheduledTask ...`; `Set-Service Spooler -StartupType Disabled` |
| Task or program rewrites hosts | Disable that task or program | Back up hosts, then comment out the line (`#`) and `ipconfig /flushdns` | Restore the backup copy |
| Unknown proxy | Disable the task or program that sets it | Clear ProxyEnable/ProxyServer (HKCU) | Restore the old values shown before |

Delete a task only when the person asks for deletion explicitly, after the export.

## Elevation

The Claude Code shell is usually not elevated. For an approved admin change:

1. Write the change as a small script with the file-writing tool, for example `fix-A2.ps1` in the reports folder (UTF-8 with BOM). The script runs the change and writes its own result to a log next to it:
   ```powershell
   $log = Join-Path $PSScriptRoot 'fix-A2.log'
   try { Set-Service Spooler -StartupType Automatic -ErrorAction Stop; Start-Service Spooler -ErrorAction Stop
         "OK $(Get-Date -Format s) " + ((Get-Service Spooler | Select-Object Status, StartType) | Out-String) | Set-Content $log -Encoding UTF8 }
   catch { "FAIL $(Get-Date -Format s) $($_.Exception.Message)" | Set-Content $log -Encoding UTF8 }
   ```
2. Show the person that exact script content as the command for that action ID. After yes, run:
   ```powershell
   Start-Process powershell -Verb RunAs -Wait -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File',"`"$path`""
   ```
   (`-ExecutionPolicy Bypass` here applies to this one process only.)
3. Tell the person in one line that a Windows approval window is about to appear on their screen.
4. If the UAC prompt is declined, Start-Process throws "The operation was canceled by the user". Report it, change nothing else, and offer the manual steps.
5. Read the log, then verify independently with a read-only check. The log alone isn't proof.

Never try to bypass UAC, edit permissions to avoid it, or use another account.

## Verify and recurrence
```powershell
# immediate
Get-Service Spooler | Select-Object Status, StartType
# after the wait (default 90 s; up to 180 s without asking)
Start-Sleep -Seconds 90; Get-Service Spooler | Select-Object Status, StartType; Get-Date -Format 'HH:mm:ss'
```
Run the same check that showed the fault, plus the person's own symptom (the site resolves to a real address, the printer is listed). If the state reverted, the origin is still active: report "the fix didn't hold" and return to the cause hunt.
