---
description: Fix one PC problem fast, with an explicit approval for every change, then verify the fix holds.
argument-hint: "[describe the problem]"
---

Use the `it-quick-support` skill to handle this problem from start to finish: $ARGUMENTS

Every change waits for an explicit yes to its action ID, after you show the exact command, its risk and its undo. The plugin's guard hook blocks destructive commands and asks for confirmation on risky ones; never route around a block.
