# Sending the person's choices straight to the session (same mechanism as the html-plan skill)

Adapted from the artifact template of a companion html-plan skill (not included in this repository); verified live on 2026-10-23.

## 1. Publish with capabilities
First publish of `reports\live.html`: `Artifact` with `capabilities: {"db": {}, "user": {}, "comments": {}}`. Later republishes: same `file_path`, no `capabilities`.
After the first publish, check once: `ArtifactComments` `watch` shows the artifact with "auto-replies armed".

## 2. On the page
On load: `const db = window.claude && window.claude.use ? await window.claude.use('db') : null;`. If null, show "התצוגה הזאת לקריאה בלבד. כדי שהבחירות יישמרו, פתח את הדף ב-claude.ai כשאתה מחובר לחשבון." and keep the page readable.
Each approve/reject click: `await db.doc('choices/<rec-id>').set({verdict:'approve'|'reject', at:new Date().toISOString()})`.
The button "שליחת הבחירות לסוכן": store the choices, then call sendToClaude with a Hebrew summary:

```js
async function sendToClaude(text){
  const c = window.claude && window.claude.use ? await window.claude.use('comments') : null;
  if(!c || !c.sendToClaude) return 'no comments capability in this view';
  let can='off'; try{can=await c.canSendToClaude();}catch(e){}
  if(can!=='available') return {writers_only:'only editors can send to Claude',no_session:'no Claude session is listening right now',off:'sending to Claude is off in this view'}[can]||can;
  const anchor=await c.anchorFor($('#finish'));
  await c.sendToClaude({anchor,text:text||summary()});
  return '';
}
```

Status text after the click (Hebrew): success "הבחירות נשלחו לסוכן. התשובה תופיע בדף." ; failure "הבחירות נשמרו, אבל לא הגיעו לסוכן (<סיבה>). כתוב בצ'אט: ""עדכן קריאה""."

## 3. In the session
A comment from the page arrives in the session by itself. Read `choices/` with `ArtifactData` `list`, run only the approved items, record each choice in the ticket and the activity log, republish, then reply in the comment thread in Hebrew and resolve it. If the person writes "עדכן קריאה" in chat, read `choices/` the same way.
## 4. Action buttons for every waiting item (not only recommendations)
Every item in "⏳ ממתין לך" that asks the person to choose (close proposal, save offer, On Hold confirmation, reopen, a question with options, a manual step with "בוצע") gets real buttons on the page, the same labels as in the chat. Never render such an item as text only or with "ענה בצ'אט" instead of buttons.
Markup: `<div class="act" data-id="<item-id>">` with one `<button data-v="<value>">` per option (for example `save:yes` / `save:no`, `close:yes` / `close:no`).
Each click:
```js
document.querySelectorAll('.act button').forEach(b=>b.addEventListener('click',async()=>{
  const el=b.closest('.act'), id=el.dataset.id, v=b.dataset.v;
  el.querySelectorAll('button').forEach(x=>x.disabled=true); b.classList.add('on');
  if(db) try{ await db.doc('actions/'+id).set({value:v,label:b.textContent,at:new Date().toISOString()}) }catch(_){}
  let err=''; try{ err=await sendToClaude('קריאה <ID> · '+id+': '+b.textContent) }catch(x){ err=String(x&&x.message||x) }
  el.querySelector('.st').textContent = err ? 'הבחירה נשמרה, אבל לא הגיעה לסוכן ('+err+'). כתוב בצ\'אט: "עדכן קריאה".' : 'הבחירה נשלחה לסוכן. התשובה תופיע בדף.';
}));
```
`sendToClaude` is the function in section 2 (anchor: the item's own element instead of `#finish` when available). The "שליחת הבחירות לסוכן" button for recommendations stays as it is.
In the session: a comment from an action button is handled like a chat answer (SKILL.md section 0, chat and page in sync): read `actions/` with `ArtifactData` `list`, carry out the choice exactly (for example the explicit save with backup), mark the item "נענה בדף ב-HH:MM: <הבחירה>", remove it from "⏳ ממתין לך", add an activity_log entry, republish, reply in the thread and resolve it. If the person answered in the chat first, mark the page item answered and disable its buttons.
## 5. Lock after sending, resume the clock (mandatory)
- On click of any send/choice button: immediately disable every button of that item (and the batch "send choices" button), show "✓ נשלח <HH:mm> · <הבחירה>" in place of the buttons, and save the state in `actions/<id>` so a reload keep the item locked (read `actions/` on load; an item that has an action is rendered locked, never clickable again).
- The session, on reading the action: marks the item "נענה" on the page, moves it out of "⏳ ממתין לך", sets the status back from On Hold to In Progress, resumes the handling timer (the paused time is not counted), logs the action with time in the activity log, and republishes within the same turn.
- Sending the same item twice is a bug; if a duplicate action arrives, ignore it and keep the first.

## 6. Manual steps the person takes on (mandatory)
- Every manual step (only the person can do it) gets three working buttons: "בוצע", "אטפל בזה בעצמי" and "עדיין לא". Before publishing, test that each button is clickable and sends (sendToClaude fires, `actions/<id>` is written); a button that can't be clicked is a bug.
- "אטפל בזה בעצמי" (by button or in chat): the step becomes a follow-up task owned by the person, listed in a "📌 משימות שלך להמשך" box with what to do and where. It is no longer a waiting item and does not keep the ticket open or the clock paused.
- When nothing else is waiting on the agent or the person, the session offers to close the ticket right away (Verified then Closed after the person's approval, with type and resolution_code), noting the open follow-up tasks in the resolution.
- Syntax check before every publish: extract each inline <script> and run `node --check` on it (or an equivalent parser). A Hebrew word with an apostrophe (צ'אט, ג'ימייל) inside a single-quoted JS string breaks the whole script, which silently kills every button, the timer and the auto-jump. Put Hebrew UI text in double-quoted or template strings, or escape the apostrophe. Do not publish a page whose script fails the check.

## 7. Send must really reach the chat; choice stays changeable until handled (overrides section 5 where they differ)
- The anchor for sendToClaude is always the clicked item's own element (`c.anchorFor(btn.closest('.item'))`), never a fixed id like `#finish` that may not exist on the page. Before publishing, check that every element passed to anchorFor exists.
- Lock only after a successful send. If the send fails, keep the buttons enabled, show the real error in Hebrew, and keep the item highlighted in "⏳ ממתין לך".
- After a successful send, show "✓ נשלח <שעה> · <בחירה>" plus a "שנה בחירה" button that re-opens the choices until the session marks the item "נענה"; a changed choice is sent again and the session acts on the latest one.
- Waiting items keep their highlight (amber border, badge, top banner) until the session marks them answered; a click alone never removes the highlight.

## 8. Always a way out: every item and the ticket can be closed by the person
- Every waiting item, besides its specific choices, always has these buttons: "בוצע", "אטפל בזה בעצמי" (moves to "📌 משימות שלך להמשך"), "שמור להמשך" (keeps it as a saved follow-up with a date if given, does not block the ticket), and "דלג, לא נדרש" (closes the item as not needed, logged with time).
- The ticket itself always shows, at the bottom of "⏳ ממתין לך" (and in the header), a ticket-level bar: "סגור קריאה עכשיו" (close as is: the session fills type and resolution_code, e.g. "נסגר לבקשת המשתמש" / "הועבר לטיפול המשתמש", lists unresolved items and follow-ups, moves to Closed), "סגור, השאר משימות להמשך", and "השהה (On Hold)". These never need a chat reply.
- A close request from the person is final consent to close: the session closes in the same turn, without asking again, after writing the summary and findings to the page.
