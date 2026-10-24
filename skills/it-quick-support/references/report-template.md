# Short report: format and location

Write the report **after** the fix and its verification after the wait, or when stopping (budget reached, approval declined, nobody there to answer UAC). Keep it to about one screen, in the person's language, using right-to-left Markdown for Hebrew.

## Where
- Folder: `IT-Agent-Quick\reports\` under the person's Documents folder (`[Environment]::GetFolderPath('MyDocuments')`). Create it if it's missing; writes to this folder (the report, the ticket files in `tickets\IT-NNNN.json` and `live.html`, see SKILL.md section 3a) are the only file writes that need no approval. Say so in one line the first time.
- File name: `YYYY-MM-DD-HHMM-<short-topic>.md` (ASCII topic, such as `printer`, `wikipedia`).
- Before step A, if earlier reports exist there, read the last few file names. The same topic within 30 days is a recurrence: say so in one line and start the cause hunt early.
- Optional: if the person asks for a page, write the same content as one static `.html` (inline CSS, `dir="rtl"` for Hebrew, `<meta charset="utf-8">`, no auto-refresh, nothing from the internet) and open it with Start-Process.

## Never in the report
Computer name, username, IP or MAC addresses, serial numbers, product keys, full local paths, the PC model. Use generic words ("the router", "the user folder").

## Template (fill in, drop empty rows)

```markdown
# <topic> – <date> <time> (<zone>)
**Finding:** <one line>
**Cause:** <one line> · **Origin (what caused it):** <one line, or "not found – checked: tasks, policies, startup, events">
**Status:** fixed and holding after <N> seconds / fixed, not yet verified / not fixed – <why>

| Step | What was checked | Key line |
|---|---|---|
| 1 | ... | `...` |

## Changes
| ID | What | Command | Result | Undo |
|---|---|---|---|---|
| A1 | ... | `...` | approved, done ✓ / declined | `...` |

## Before / after
- Before: `...`
- Right after: `...`
- After <N> s: `...`

## If it happens again
What you see → what to do (2-3 lines, plain words).

<elapsed minutes> min · <tool calls> tool calls · signed: <agent name>
```

## Hebrew example (abbreviated)

```markdown
# מדפסת – 21.10.2026 18:40 (UTC+3)
**ממצא:** שירות ההדפסה (Print Spooler) היה מושבת, ולכן לא נראו מדפסות.
**סיבה:** השירות הוגדר כ-Disabled. · **מה גרם לזה:** משימה מתוזמנת שרצה כל דקה ומשביתה אותו (נמצאה, מושבתת עכשיו).
**מצב:** תוקן, ובבדיקה חוזרת אחרי 90 שניות התיקון החזיק.

| שלב | מה נבדק | שורה מרכזית |
|---|---|---|
| 1 | מצב השירות | `Stopped  Disabled` |
| 2 | אירועי שינוי | `7040 … auto start to disabled` (חוזר כל דקה) |
| 3 | משימות מתוזמנות | `Action = sc.exe config Spooler start= disabled` |

## שינויים
| מזהה | מה | תוצאה | ביטול |
|---|---|---|---|
| A1 | השבתת המשימה (אחרי גיבוי) | אושר ובוצע ✓ | `Enable-ScheduledTask …` |
| A2 | הפעלת שירות ההדפסה | אושר ובוצע ✓ | `Set-Service Spooler -StartupType Disabled` |

## לפני / אחרי
- לפני: `Stopped  Disabled` · מיד אחרי: `Running  Automatic` · אחרי 90 שניות: `Running  Automatic`

## אם זה קורה שוב
אם המדפסות נעלמות שוב, כנראה תוכנה אחרת משביתה את השירות. בקשו "תבדוק מה משבית את שירות ההדפסה".

7 דקות · 14 פעולות · חתום: סוכן ה-IT
```

## Ticket page `live.html`: order of sections (SKILL.md section 0)

Hebrew only, `dir="rtl"`, `<meta charset="utf-8">`, inline CSS, nothing from the internet. Sections, top to bottom:

1. **Header:** ticket number, state, priority, time opened (from Get-Date), and "ממתין ל:" (who holds it now; value exactly "לך" or "IT Agent", never "אתה"). To the LEFT of "ממתין ל", above "⏳ ממתין לך", the ticket timer "⏱ זמן בטיפול": "<elapsed> מתוך יעד <target> (P<n>)", green under 75%, orange from 75%, red past the target; "יעד SLA לא הוגדר לעדיפות זו" when there is no target; while waiting for the person it is gray and paused: "⏸ מושהה, ממתין לך מ-HH:MM". Recomputed with Get-Date at every republish. The timer is a live clock: an inline `setInterval` script ticks every second and shows "HH:MM:SS" (elapsed = now - opened - paused), with no republish needed; it stands still only while paused.
2. **"⏳ ממתין לך" (always first, strong highlight):** every recommendation waiting for approve or reject, every manual step with "מחכה לך מ-HH:MM", and any proposal to close. Empty: "אין כרגע שום דבר שממתין לך".
   - **Copy buttons (command boxes only):** every command the person is asked to run sits in its own command box with a "📋 העתק" button next to it that copies exactly that command and shows "הועתק ✓". No copy button on any other text. Layout fix (the button was hidden when the command was long): the copy button sits OUTSIDE the scrolling command box, never inside it. Markup: <div class="cmdrow"><button class="copy" data-cmd="...">...</button><div class="cmd"><code>...</code></div></div>; CSS: .cmdrow{display:flex;gap:8px;align-items:flex-start;margin:8px 0} .cmd{flex:1;min-width:0;overflow-x:auto;direction:ltr} .copy{flex:none}. Only the code scrolls; the button stays visible however long the command is.
   - **Chat requests mirrored, chat answers carried out:** every request the agent makes in the chat (in any language) also appears here in Hebrew at the same moment. If the person answers in the chat, the action is carried out as if answered on the page (for example the save), the item is marked "נענה בשיחה ב-HH:MM: <התשובה>", removed from this section, logged in "יומן פעילות" and republished.
   - **Auto-jump to a new request:** each waiting item has a unique id and creation time; the page embeds the newest unanswered id. On every load an inline script scrolls straight to a request not yet jumped to (`scrollIntoView`, `block: "center"`), focuses it and flashes a strong border for 3 seconds (ids remembered in `sessionStorage` in try/catch; without storage, jump on every load). While anything waits, a fixed banner at the top of the window, "🔔 בקשה חדשה ממתינה לך (<מספר>)", jumps to the newest request when clicked. The person never scrolls to find a request. Fix (the jump did not work in the Claude side panel): (a) jump on EVERY load and re-render, with no once-per-id memory (no sessionStorage check); (b) every waiting item has its own id w-<itemId>, and `newest` must be the id of an item that is waiting right now (the pre-publish gate asserts that getElementById("w-"+newest) exists and has class wait-item); (c) run the jump on DOMContentLoaded and retry at 300, 1000 and 2500 ms with behavior "auto" (instant), and as a fallback also set document.scrollingElement.scrollTop to the element position minus a third of the viewport; (d) while anything waits, a fixed banner stays visible at the top and clicking it jumps; (e) before publishing, open the page in a headless browser scrolled to the bottom and confirm the waiting item ends up in the viewport; log the result in the gate.
3. **Complaint rows:** one row per thing the person said; state per row (exactly four): "פתוח" / "ממתין לך" (שעון היעד של הסעיף עוצר) / "בהמתנה" / "סגור", with a state selector the person can change; a row "בהמתנה" has "פתיחה מחדש".
   - **Step lines under each complaint row (real time):** every check or action gets its own line before it runs, "HH:MM · בודק עכשיו: <מה נבדק>", republished at once; when it ends the same line becomes "HH:MM · נמצא: <הממצא>" or "HH:MM · לא נמצא דבר חריג", republished before the next step. No chat status line without a matching page line.
4. **Recommendations:** each with "אישור" / "דחייה" and the button that sends or copies the choices.
   - **Sending choices:** "אישור" / "דחייה" save to the page database, and the button "שליחת הבחירות לסוכן" sends them straight to the session (html-plan mechanism, `references/send-to-claude.md`). No copy-and-paste of choices.
5. **Handling history:** in time order, times from Get-Date.
- **Last section, "יומן פעילות":** the full activity_log, oldest first, one line per entry "HH:MM · <מי> · <מה קרה>": every check started and its result, finding, recommendation, approval/rejection, message, state or ownership change, On Hold, reopen, closure and save, added the moment it happens and republished with each entry.

Fixed Hebrew strings (use exactly):

| Use | Text |
|---|---|
| On Hold button | העברה להמתנה |
| On Hold confirmation | להעביר להמתנה? אסיים לטפל בזה עכשיו, והפריט יישאר אצלך עד שתחזור אליו. · אין לי זמן עכשיו · צריך משהו שאין לי כרגע · סיבה אחרת · כן, להעביר להמתנה · ביטול |
| On Hold, close question | האם אתה מאשר לסגור את התקלה? · כן, לסגור · לא |
| Row states | פתוח · ממתין לך · בהמתנה · סגור |
| Ticket timer | ⏱ זמן בטיפול · מתוך יעד · יעד SLA לא הוגדר לעדיפות זו · ⏸ מושהה, ממתין לך מ-HH:MM · HH:MM:SS מתוך יעד HH:MM:SS (P<n>) |
| Step lines | HH:MM · בודק עכשיו: … · HH:MM · נמצא: … · HH:MM · לא נמצא דבר חריג |
| Copy button | 📋 העתק · הועתק ✓ |
| Activity log | יומן פעילות · סוכן ה-IT · אתה |
| Answered in chat | נענה בשיחה ב-HH:MM: <התשובה> |
| New request jump | 🔔 בקשה חדשה ממתינה לך (<מספר>) |
| On Hold, recorded | בהמתנה אצלך מ-HH:MM. הסיבה: <…>. מה נשאר: <…>. · פתיחה מחדש |
| Save offer | שמירת הקריאה הסופית · לשמור את הקריאה הסופית בתיקייה IT-Agent-Quick/Reports? · כן, לשמור · לא עכשיו |
| Saved, recorded | הקריאה נשמרה בתיקייה ב-HH:MM |
| Close proposal | כל השאר טופל. נשאר פתוח רק: <…>. אפשר לסגור את הקריאה עכשיו ולטפל בזה במועד אחר. · סגירת הקריאה · השארת הקריאה פתוחה |
| Closed, recorded | הקריאה נסגרה לבקשתך ב-HH:MM ותטופל במועד אחר. נשאר פתוח: <…> |
| Manual step | צעד ידני, אין פקודה. מחכה לך מ-HH:MM. כשתסיים, כתוב "עשיתי" ואבדוק שוב. |

Second person singular only ("אתה", "כתוב", "תסיים"); no slash forms such as "כתוב/י".

In `tickets\IT-NNNN.json`, record each On Hold under `on_hold` (scope fault/ticket, row, reason, since, what is left; reopened_at when reopened) and a close at the person's request under `closure` (time, by "person", what stays open).
## Ticket file: approved fields (2026-10-23)
See SKILL.md section 3a, "Also required in every ticket file". Minimal shape:
`{"id","type","title","category","impact","urgency","priority","provisional_priority","state","assigned_to","holder","holder_history":[],"reporter","affected_component","times":{"opened","first_response","resolved","verified","closed"},"sla":{"first_response_target_min":5,"resolve_target_min","clock","paused_minutes","result"},"complaints":[{"id","text","state":"Open|Waiting for user|On Hold|Closed","state_history":[],"sla":{"clock","paused_minutes"},"on_hold":null,"ticket"}],"evidence":[{"level","line"}],"cause":{"text","confidence","origin"},"actions":[{"id","what","command","risk","undo","state"}],"resolution":{"code","notes","before","after","after_wait"},"second_level":{},"activity_log":[{"at","kind","by","text","ref"}],"recurrence":{"checked","same_signature_within_30_days","related"},"next_time":[],"parent","children":[],"on_hold":[],"closure":null,"saved":null}`

The final copy is written to `Documents/IT-Agent-Quick/Reports` only after the person presses "כן, לשמור" (SKILL.md section 0, explicit save). Never automatically. The page is saved as `Reports/IT-NNNN.html` (its own ticket number, never a fixed `live.html`), and any existing file is first copied to `Reports/.backups/<name>.<yyyyMMdd-HHmmss>` and checked; if the backup fails, nothing is saved and the person is asked.

On Hold rows do not block closing: the ticket can close and be saved to `Documents/IT-Agent-Quick/Reports` while rows stay On Hold. A row becomes On Hold only after the person answers "כן, לסגור" to "האם אתה מאשר לסגור את התקלה?".

**Mandatory look of every open waiting item (no plain cards):**
```css
.wait-item{border:3px solid #f5a623;background:#3a2e12;border-radius:12px;padding:14px 16px;box-shadow:0 0 0 4px rgba(245,166,35,.25);animation:pulse 2s ease-in-out 3}
.wait-item h3::before{content:"⏳ ממתין לך";background:#f5a623;color:#111;font-weight:700;border-radius:6px;padding:2px 8px;margin-left:8px}
.wait-item button{background:transparent;color:inherit;border:2px solid #b8860b;font-size:16px;padding:10px 18px} .wait-item button.chosen,.wait-item button[aria-pressed="true"]{background:#f5a623;color:#111;font-weight:700;border-color:#f5a623} .wait-item .rec{font-size:12px;color:#f5a623;margin-inline-start:6px}
@keyframes pulse{50%{box-shadow:0 0 0 10px rgba(245,166,35,.05)}}
```
- All choice buttons start outlined (empty); the recommended one only gets a small "recommended" tag (`.rec`). The whole "⏳ ממתין לך" section gets an amber header bar when it has open items, and a gray, calm look only when it is empty. Answered items lose the amber style and move below, grayed, with "✓ נענה <שעה>". Choice buttons show the person's choice, never the default : all option buttons start empty (outlined, no fill); no button is pre-filled, not even the recommended one, which gets only a small "recommended" tag in the person's language. When the person clicks an option, that button fills (class `chosen`, amber fill, `aria-pressed="true"`) and every other option button of the item is outlined. "Change choice" re-opens the item, and the next click moves the fill to the newly chosen button; the "sent" line names the latest choice. On reload the fill is restored from the saved answer, never from the default. The pre-publish gate checks that no option has `chosen` before an answer exists and that, after a simulated click, exactly the clicked button has it.

### Voice (dictation and conversation mode)
- See SKILL.md "Voice: dictation and conversation". Markup per free-text box: <div class="ftrow"><textarea class="ft"></textarea><button class="mic" aria-pressed="false">&#127908;</button><button class="send">...</button></div>; a page-level toggle <button id="voice-mode" aria-pressed="false">. CSS: .mic{flex:none;border:2px solid #b8860b;background:transparent;border-radius:50%;width:44px;height:44px} .mic[aria-pressed="true"],.wait-item button.mic[aria-pressed="true"]{background:#d32f2f;border-color:#d32f2f;animation:pulse 1s infinite} .mic.unavailable{opacity:.6}.
