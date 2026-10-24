'use strict';
/**
 * Shared safety rules for the helpdesk PreToolUse guard.
 * Each rule: { id, level: 'deny'|'ask', reason, test(command) -> boolean }
 * Patterns are case-insensitive and match against the full command string
 * (and, when present, nested $(...), backticks and -Command arguments).
 */

function has(cmd, re) {
  return re.test(cmd);
}

const RULES = [
  // ---- DENY: destructive / high-risk ---------------------------------
  {
    id: 'disk-format',
    level: 'deny',
    reason: 'Disk format / wipe commands are blocked by this plugin.',
    test: (c) =>
      has(c, /\bformat\s+[a-z]:/i) ||
      has(c, /\bFormat-Volume\b/i) ||
      has(c, /\bClear-Disk\b/i) ||
      has(c, /\bInitialize-Disk\b/i),
  },
  {
    id: 'diskpart-clean',
    level: 'deny',
    reason: 'diskpart clean / wipe is blocked by this plugin.',
    test: (c) =>
      has(c, /\bdiskpart\b/i) ||
      has(c, /\bclean\s+(all|disk)\b/i),
  },
  {
    id: 'cipher-wipe',
    level: 'deny',
    reason: 'cipher /w (free-space wipe) is blocked by this plugin.',
    test: (c) => has(c, /\bcipher\s+(\/[a-z]*\s+)*/i) && has(c, /\/w\b/i),
  },
  {
    id: 'vssadmin-delete',
    level: 'deny',
    reason: 'Deleting Volume Shadow Copies is blocked by this plugin.',
    test: (c) => has(c, /\bvssadmin\b/i) && has(c, /\bdelete\b/i),
  },
  {
    id: 'bcdedit',
    level: 'deny',
    reason: 'bcdedit (boot configuration changes) is blocked by this plugin.',
    test: (c) => has(c, /\bbcdedit\b/i),
  },
  {
    id: 'reg-delete-hklm',
    level: 'deny',
    reason: 'Deleting keys under HKLM is blocked by this plugin.',
    test: (c) =>
      (has(c, /\breg\s+delete\b/i) && has(c, /\bHKLM\b/i)) ||
      (has(c, /\bRemove-Item\b/i) && has(c, /HKLM:\\/i)),
  },
  {
    id: 'recursive-delete-system',
    level: 'deny',
    reason: 'Recursive delete of a system path is blocked by this plugin.',
    test: (c) => {
      const isRecurse =
        has(c, /\bRemove-Item\b[\s\S]*?-(Recurse|r)\b/i) ||
        has(c, /\brm\s+(-[a-zA-Z]*r[a-zA-Z]*|--recursive)\b/i) ||
        has(c, /\brmdir\s+\/s\b/i) ||
        has(c, /\bdel\s+\/s\b/i);
      if (!isRecurse) return false;
      return has(
        c,
        /(\\Windows\\|\\Program Files|\\ProgramData\\|C:\\$|\/windows\/|\/etc\/|\/usr\/|\/System)/i
      );
    },
  },
  {
    id: 'disable-defender',
    level: 'deny',
    reason: 'Disabling Microsoft Defender is blocked by this plugin.',
    test: (c) =>
      (has(c, /\bSet-MpPreference\b/i) &&
        has(c, /-(DisableRealtimeMonitoring|DisableIOAVProtection|DisableBehaviorMonitoring|ExclusionPath)\b/i)) ||
      (has(c, /\bMpCmdRun\.exe\b/i) && has(c, /-RemoveDefinitions/i)),
  },
  {
    id: 'disable-firewall',
    level: 'deny',
    reason: 'Disabling the Windows Firewall is blocked by this plugin.',
    test: (c) =>
      (has(c, /\bSet-NetFirewallProfile\b/i) && has(c, /-(Enabled|Enable)\s+\$?false|Disabled/i)) ||
      has(c, /\bnetsh\s+advfirewall\s+set\b[\s\S]*?\boff\b/i),
  },
  {
    id: 'account-changes',
    level: 'deny',
    reason: 'Creating, deleting or elevating local accounts is blocked by this plugin.',
    test: (c) =>
      has(c, /\bnet\s+user\b/i) ||
      has(c, /\bnet\s+localgroup\b/i) ||
      has(c, /\bNew-LocalUser\b/i) ||
      has(c, /\bRemove-LocalUser\b/i) ||
      has(c, /\bAdd-LocalGroupMember\b/i) ||
      has(c, /\bEnable-LocalUser\b/i) ||
      has(c, /\bDisable-LocalUser\b/i) ||
      has(c, /\bSet-LocalUser\b/i),
  },
  {
    id: 'download-and-execute',
    level: 'deny',
    reason: 'Downloading and executing a script in one step (iwr|iex and similar) is blocked by this plugin.',
    test: (c) =>
      has(c, /\b(iwr|Invoke-WebRequest|curl|wget)\b[\s\S]*?\|\s*(iex|Invoke-Expression)\b/i) ||
      has(c, /\b(iex|Invoke-Expression)\b[\s\S]*?\b(iwr|Invoke-WebRequest)\b/i) ||
      has(c, /\bStart-BitsTransfer\b[\s\S]*?\|\s*(iex|Invoke-Expression)\b/i),
  },
  {
    id: 'run-found-script',
    level: 'deny',
    reason: 'Running a script found on disk without showing its contents first is blocked. Read it, then ask.',
    test: (c) =>
      has(c, /\b(powershell|pwsh)\b[\s\S]*?-(File|f)\s+["']?(C:\\Users\\|%USERPROFILE%|\$env:USERPROFILE|\$HOME)/i) ||
      has(c, /\b(bash|sh)\s+["']?\/tmp\//i),
  },

  // ---- ASK: medium-risk, needs explicit confirmation ------------------
  {
    id: 'service-change',
    level: 'ask',
    reason: 'Changing a Windows service needs your confirmation.',
    test: (c) =>
      has(c, /\b(Stop-Service|Start-Service|Restart-Service|Set-Service|Suspend-Service|Resume-Service)\b/i) ||
      has(c, /\bsc(\.exe)?\s+(stop|start|config|delete|create)\b/i) ||
      has(c, /\bnet\s+(stop|start)\b/i),
  },
  {
    id: 'registry-write',
    level: 'ask',
    reason: 'Writing to the registry needs your confirmation.',
    test: (c) =>
      has(c, /\b(Set-ItemProperty|New-ItemProperty|Remove-ItemProperty|New-Item)\b[\s\S]*?HK(LM|CU|CR|U|CC):\\/i) ||
      has(c, /\breg\s+(add|import|copy)\b/i),
  },
  {
    id: 'driver-install',
    level: 'ask',
    reason: 'Installing or updating a driver needs your confirmation.',
    test: (c) =>
      has(c, /\bpnputil\b/i) ||
      has(c, /\bAdd-WindowsDriver\b/i) ||
      has(c, /\bInstall-WindowsFeature\b/i) ||
      has(c, /\bEnable-WindowsOptionalFeature\b/i),
  },
  {
    id: 'restart-shutdown',
    level: 'ask',
    reason: 'Restarting or shutting down the PC needs your confirmation.',
    test: (c) =>
      has(c, /\b(Restart-Computer|Stop-Computer)\b/i) ||
      has(c, /\bshutdown(\.exe)?\b/i) ||
      has(c, /\blogoff\b/i),
  },
  {
    id: 'firewall-rule-change',
    level: 'ask',
    reason: 'Changing a firewall rule needs your confirmation.',
    test: (c) =>
      has(c, /\b(New-NetFirewallRule|Set-NetFirewallRule|Remove-NetFirewallRule)\b/i) ||
      has(c, /\bnetsh\s+advfirewall\s+firewall\b/i),
  },
  {
    id: 'scheduled-task-change',
    level: 'ask',
    reason: 'Creating, changing or removing a scheduled task needs your confirmation.',
    test: (c) =>
      has(c, /\b(Register-ScheduledTask|Unregister-ScheduledTask|Set-ScheduledTask|Disable-ScheduledTask|Enable-ScheduledTask)\b/i) ||
      has(c, /\bschtasks\b[\s\S]*?\/(Create|Change|Delete|End)\b/i),
  },
  {
    id: 'package-install',
    level: 'ask',
    reason: 'Installing or removing software needs your confirmation.',
    test: (c) =>
      has(c, /\b(winget|choco|scoop)\s+(install|uninstall|upgrade|remove)\b/i) ||
      has(c, /\bmsiexec\b/i) ||
      has(c, /\bInstall-Package\b/i) ||
      has(c, /\bStart-Process\b[\s\S]*?\.msi\b/i),
  },
];

function classify(command) {
  if (typeof command !== 'string' || !command.trim()) {
    return { decision: null };
  }
  // Expand a few common wrappers so nested commands are still caught.
  const flattened = command
    .replace(/`([^`]+)`/g, ' $1 ')
    .replace(/\$\(([^)]+)\)/g, ' $1 ');

  for (const rule of RULES) {
    if (rule.level === 'deny' && rule.test(flattened)) {
      return { decision: 'deny', rule };
    }
  }
  for (const rule of RULES) {
    if (rule.level === 'ask' && rule.test(flattened)) {
      return { decision: 'ask', rule };
    }
  }
  return { decision: null };
}

module.exports = { RULES, classify };
