# Licensed to Fix

An IT helpdesk agent plugin for Claude Code.

It checks a Windows PC read-only, finds the real cause of a problem, proposes each fix with the exact command, its risk and how to undo it, runs nothing without an explicit yes, verifies that the fix holds, and keeps a local ticket. Hebrew-first ticket page; English instructions in this repository.

> Display name: **Licensed to Fix** · slug: `licensed-to-fix`. The product name does not contain "Windows", "Claude", or any film/franchise allusion; "for Windows PCs" appears only as a platform description.

Website: https://licensed-to-fix.app · Privacy: https://licensed-to-fix.app/privacy/ · Support: https://licensed-to-fix.app/support/

## What you get

| Component | Purpose |
|---|---|
| Skill `it-quick-support` | Fast single-problem support (port of the public skill) |
| Skill `helpdesk-core` | Full guided session (port of IT Agent prompt v2.7) |
| Commands `/licensed-to-fix:diagnose`, `/licensed-to-fix:quick-fix`, `/licensed-to-fix:net-check`, `/licensed-to-fix:guard-status` | Short entry points |
| PreToolUse hook | Blocks destructive shell commands; asks on medium-risk ones |
| PostToolUse hook | Redacts PC identifiers before tool output reaches the model |
| `scripts/Invoke-Redacted.ps1` | Source-side redaction for failed commands (see Limitations) |

Based on [nsharon4/it-agent](https://github.com/nsharon4/it-agent) (prompt v2.7 and `it-quick-support`).

This repository is both the plugin and its Claude Code marketplace (`licensed-to-fix-marketplace`), with `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` at the repo root (`source: "./"`).

## Requirements

- A Windows 10 or 11 PC (tested upstream on Windows 11 with Windows PowerShell 5.1).
- [Claude Code](https://code.claude.com/docs/en/setup) with a paid Claude plan (Pro or higher).
- Node.js on `PATH` (used by the hooks; Claude Code's documented cross-platform hook pattern).

## Install

In a Claude Code session:

```text
/plugin marketplace add nsharon4/licensed-to-fix
/plugin install licensed-to-fix@licensed-to-fix-marketplace
```

From your shell (same sources):

```bash
claude plugin marketplace add nsharon4/licensed-to-fix
claude plugin install licensed-to-fix@licensed-to-fix-marketplace
```

Or add and install in one step (Claude Code v2.1.275+ in-session / v2.1.292+ in the shell):

```text
/plugin install licensed-to-fix --marketplace nsharon4/licensed-to-fix
```

```bash
claude plugin install licensed-to-fix --marketplace nsharon4/licensed-to-fix
```

For a one-session local load from a checkout:

```bash
claude --plugin-dir /path/to/licensed-to-fix
```

## Safety (enforced in code, not only in the prompt)

The PreToolUse hook matches `Bash|PowerShell` and:

- **Denies** format/wipe, diskpart clean, `cipher /w`, VSS delete, `bcdedit`, HKLM registry deletes, recursive deletes of system paths, disabling Defender or the firewall, local account changes, and download-and-execute patterns (`iwr | iex`).
- **Asks** (confirmation prompt) for service changes, registry writes, driver installs, restart/shutdown, firewall rule changes, scheduled-task changes, and package installs.

If a hook fails to start, `onFailure: "block"` refuses the tool call (Claude Code v2.1.295+). Prefer **Manual** permission mode for IT work; do not use bypass modes with this plugin.

## Privacy / redaction

The PostToolUse hook replaces identifiers in successful Bash/PowerShell output with tokens such as `<COMPUTER#abcd>`, `<USER#abcd>`, `<IPv4:private#abcd>`, `<MAC#abcd>`, `<SERIAL#abcd>`, `<EMAIL#abcd>`, `<SID#abcd>`, `<PRODUCT-KEY#abcd>`, `<DOMAIN#abcd>` via `updatedToolOutput` ([hooks reference](https://code.claude.com/docs/en/hooks.md#posttooluse-decision-control)).

**Limitation:** `PostToolUse` runs only after a successful tool call. Failed commands fire `PostToolUseFailure`, which cannot replace output — only `additionalContext`. For those cases, run diagnostics through `scripts/Invoke-Redacted.ps1`, which redacts at the source. Telemetry may still see the original successful output before the hook runs.

This plugin never asks for passwords, tokens or keys. Say clearly at the start of every session that this helpdesk assistant is an AI agent.

## Example prompts

1. "The printer doesn't work" — then run `/licensed-to-fix:quick-fix` (or just describe the problem; the skill triggers).
2. "No internet on this PC" — if Claude Code itself is offline, run the bundled `net-offline-check.ps1` from a desktop shortcut; otherwise `/licensed-to-fix:net-check`.
3. "Walk me through a full health check of this PC" — use the `helpdesk-core` skill / full mode.

## License

[MIT](LICENSE) · Copyright (c) 2026 Nir Sharon

## Author

Nir Sharon · [LinkedIn](https://www.linkedin.com/in/nir-sharon-270439169)

Website: https://licensed-to-fix.app · Privacy: https://licensed-to-fix.app/privacy/ · Support: https://licensed-to-fix.app/support/

## Disclaimer

Provided as is. Use at your own risk. Review every command before you approve it. Back up important data before any change. Never give the agent passwords, codes or keys.
