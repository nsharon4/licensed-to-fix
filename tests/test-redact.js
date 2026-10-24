'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { redact, redactToolResponse } = require('../hooks/scripts/redact');
const { buildPostToolUse, buildPostToolUseFailure } = require('../hooks/scripts/post-tool-redact');
const { decide } = require('../hooks/scripts/pre-tool-guard');

const fixture = fs.readFileSync(path.join(__dirname, 'fixtures', 'sample-output.txt'), 'utf8');

let failed = 0;
function check(label, fn) {
  try { fn(); console.log('  ok  ' + label); }
  catch (e) { failed++; console.error('  FAIL ' + label + ': ' + e.message); }
}

console.log('redact synthetic sample');
const { text, count } = redact(fixture);
check('redacts something', () => assert.ok(count >= 8, 'count=' + count));
check('no raw IPv4 private', () => assert.ok(!/192\.168\.10\.55/.test(text)));
check('no raw MAC', () => assert.ok(!/AA:BB:CC:DD:EE:01/i.test(text)));
check('no raw email', () => assert.ok(!/jane\.doe@example\.com/i.test(text)));
check('no raw SID', () => assert.ok(!/S-1-5-21-111111111-222222222-333333333-1001/.test(text)));
check('no raw product key', () => assert.ok(!/AAAAA-BBBBB-CCCCC-DDDDD-EEEEE/.test(text)));
check('no raw username path', () => assert.ok(!/C:\\Users\\janedoe\\/i.test(text)));
check('no DESKTOP- name', () => assert.ok(!/DESKTOP-SYNTH01/i.test(text)));
check('keeps 127.0.0.1', () => assert.ok(/127\.0\.0\.1/.test(text)));
check('tokens present', () => {
  assert.ok(/<IPv4:private#/.test(text));
  assert.ok(/<MAC#/.test(text));
  assert.ok(/<EMAIL#/.test(text));
  assert.ok(/<USER#/.test(text));
  assert.ok(/<COMPUTER#/.test(text));
  assert.ok(/<SID#/.test(text));
  assert.ok(/<PRODUCT-KEY#/.test(text));
});

console.log('updatedToolOutput shape');
check('PostToolUse rewrite', () => {
  const out = buildPostToolUse({
    hook_event_name: 'PostToolUse',
    tool_name: 'PowerShell',
    tool_response: { stdout: fixture, stderr: '', interrupted: false, isImage: false },
  });
  assert.ok(out);
  assert.strictEqual(out.hookSpecificOutput.hookEventName, 'PostToolUse');
  assert.ok(out.hookSpecificOutput.updatedToolOutput);
  assert.strictEqual(typeof out.hookSpecificOutput.updatedToolOutput.stdout, 'string');
  assert.strictEqual(out.hookSpecificOutput.updatedToolOutput.interrupted, false);
  assert.ok(!/janedoe/i.test(out.hookSpecificOutput.updatedToolOutput.stdout));
});

check('PostToolUse no-op when clean', () => {
  const out = buildPostToolUse({
    tool_name: 'Bash',
    tool_response: { stdout: 'ok\n', stderr: '', interrupted: false, isImage: false },
  });
  assert.strictEqual(out, null);
});

check('PostToolUseFailure uses additionalContext only', () => {
  const out = buildPostToolUseFailure({
    hook_event_name: 'PostToolUseFailure',
    tool_name: 'Bash',
    error: 'Exit code 1\nUserName: janedoe\n',
  });
  assert.ok(out);
  assert.ok(out.hookSpecificOutput.additionalContext.includes('<USER#'));
  assert.ok(!out.hookSpecificOutput.updatedToolOutput, 'must not claim updatedToolOutput on failure');
});

console.log('PreToolUse decide()');
check('deny format', () => {
  const d = decide({ tool_name: 'PowerShell', tool_input: { command: 'format D:' } });
  assert.strictEqual(d.hookSpecificOutput.permissionDecision, 'deny');
});
check('ask Stop-Service', () => {
  const d = decide({ tool_name: 'Bash', tool_input: { command: 'Stop-Service Spooler' } });
  assert.strictEqual(d.hookSpecificOutput.permissionDecision, 'ask');
});
check('allow Get-Service', () => {
  const d = decide({ tool_name: 'PowerShell', tool_input: { command: 'Get-Service' } });
  assert.strictEqual(d, null);
});
check('ignore Write tool', () => {
  const d = decide({ tool_name: 'Write', tool_input: { file_path: 'x', content: 'format C:' } });
  assert.strictEqual(d, null);
});

check('redactToolResponse preserves shape', () => {
  const { response, count: n } = redactToolResponse({
    stdout: 'UserName: bob\n',
    stderr: '',
    interrupted: false,
    isImage: false,
  });
  assert.ok(n >= 1);
  assert.strictEqual(response.interrupted, false);
  assert.ok(response.stdout.includes('<USER#'));
});

console.log(`\n${failed} failure(s)`);
process.exit(failed ? 1 : 0);
