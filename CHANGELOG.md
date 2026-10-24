# Changelog

## 2.7.0 — 2026-10-25

First public release.

- Ported `it-quick-support` skill and IT Agent prompt v2.7 from [nsharon4/it-agent](https://github.com/nsharon4/it-agent) @ 640a11e.
- Slash commands: `diagnose`, `quick-fix`, `net-check`, `guard-status`.
- PreToolUse safety guard (deny / ask) and PostToolUse identifier redaction (`updatedToolOutput`).
- `Invoke-Redacted.ps1` for source-side redaction when PostToolUse cannot rewrite failures.
- Unit tests with synthetic fixtures only.
- MIT license.
- Single repository layout: plugin + marketplace (`licensed-to-fix-marketplace`, `source: "./"`).
- Product identity: `licensed-to-fix` / **Licensed to Fix**; homepage https://licensed-to-fix.app.
