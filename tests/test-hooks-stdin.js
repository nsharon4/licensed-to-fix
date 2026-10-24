'use strict';
const { spawnSync } = require('child_process');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
let failed = 0;
function run(script, input) {
  const r = spawnSync('node', [path.join(root, 'hooks/scripts', script)], {
    input: JSON.stringify(input),
    encoding: 'utf8',
  });
  return r;
}
function check(label, fn) {
  try { fn(); console.log('  ok  ' + label); }
  catch (e) { failed++; console.error('  FAIL ' + label + ': ' + e.message); }
}

console.log('pre-tool-guard.js via stdin');
check('deny via stdin', () => {
  const r = run('pre-tool-guard.js', {
    hook_event_name: 'PreToolUse',
    tool_name: 'PowerShell',
    tool_input: { command: 'vssadmin delete shadows /all' },
  });
  assert.strictEqual(r.status, 0, r.stderr);
  const j = JSON.parse(r.stdout);
  assert.strictEqual(j.hookSpecificOutput.permissionDecision, 'deny');
});
check('allow silent via stdin', () => {
  const r = run('pre-tool-guard.js', {
    hook_event_name: 'PreToolUse',
    tool_name: 'Bash',
    tool_input: { command: 'Get-Service' },
  });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.strictEqual(r.stdout.trim(), '');
});

console.log('post-tool-redact.js via stdin');
check('rewrite via stdin', () => {
  const r = run('post-tool-redact.js', {
    hook_event_name: 'PostToolUse',
    tool_name: 'Bash',
    tool_response: {
      stdout: 'ComputerName: DESKTOP-SYNTH01\n',
      stderr: '',
      interrupted: false,
      isImage: false,
    },
  });
  assert.strictEqual(r.status, 0, r.stderr);
  const j = JSON.parse(r.stdout);
  assert.ok(j.hookSpecificOutput.updatedToolOutput.stdout.includes('<COMPUTER#'));
  assert.ok(!/DESKTOP-SYNTH01/.test(j.hookSpecificOutput.updatedToolOutput.stdout));
});

console.log(`\n${failed} failure(s)`);
process.exit(failed ? 1 : 0);
