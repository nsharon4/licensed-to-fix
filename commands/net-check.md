---
description: Run the read-only offline network check (link, IP, router, internet, DNS, proxy and hosts) and explain the verdict.
---

Run the bundled read-only network check and explain the result in one short paragraph:

```
powershell -NoProfile -ExecutionPolicy Bypass -File "${CLAUDE_PLUGIN_ROOT}/skills/it-quick-support/scripts/net-offline-check.ps1" -NoOpen
```

Read the report file it writes (the path is printed at the end), quote the VERDICT line, and name the first failing layer. Do not change anything. If a fix is needed, offer `/licensed-to-fix:quick-fix`.
