---
description: Read-only diagnosis of a PC problem. Finds the likely cause and what caused it, and changes nothing.
argument-hint: "[describe the problem]"
---

Diagnose this PC problem in read-only mode: $ARGUMENTS

Follow the method in the `it-quick-support` skill, steps A to D only (define, general to specific, confirm, find what caused it). Rules for this command:

- Run read-only commands only (Get-*, Test-*, Resolve-*, ipconfig, netstat, event logs, reading files and registry). Do not propose or run any change in this command.
- Quote the evidence line for every finding, with the command and the time it ran.
- End with: the likely cause, its confidence (certain / likely / unverified), what you did not check and why, and the next step. Tell the person they can run `/licensed-to-fix:quick-fix` to fix it with per-step approval.
