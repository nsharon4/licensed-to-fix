---
description: Show what the Licensed to Fix safety guard blocks or asks about, and confirm that identifier redaction is active.
---

Explain the safety rules this plugin enforces in code, in plain language and in the person's language:

1. Read `${CLAUDE_PLUGIN_ROOT}/hooks/scripts/rules.js` and summarize the **deny** rules (always blocked) and the **ask** rules (need a confirmation) as two short lists, one line per rule.
2. Explain that tool output is redacted before you see it, and list the token types (`<COMPUTER>`, `<USER>`, `<IPv4:...>`, `<MAC>`, `<SERIAL>`, `<EMAIL>`, `<SID>`, `<PRODUCT-KEY>`, `<DOMAIN>`).
3. Verify redaction is active by running `hostname` and confirming the output shows `<COMPUTER>` rather than a name. If you see a real name, say that redaction is not active and that the person should check `/hooks`.

Do not run any other command.
