#!/usr/bin/env node
'use strict';
/**
 * PreToolUse hook: deny destructive shell commands, ask on medium-risk ones.
 * Input: Claude Code hook JSON on stdin (see hooks reference).
 * Output: JSON with hookSpecificOutput.permissionDecision = deny|ask, or exit 0
 * with no output when the command is fine.
 *
 * Why Node: Claude Code's documented cross-platform hook pattern is
 * `"command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/..."]` (exec form).
 * Node is available wherever Claude Code runs. PowerShell remains the
 * language of the IT checks themselves.
 */

const { classify } = require('./rules');

function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => chunks.push(c));
    process.stdin.on('end', () => resolve(chunks.join('')));
    process.stdin.on('error', reject);
  });
}

function decide(payload) {
  const tool = payload && payload.tool_name;
  if (tool !== 'Bash' && tool !== 'PowerShell') {
    return null;
  }
  const command =
    (payload.tool_input && payload.tool_input.command) ||
    (payload.tool_input && payload.tool_input.cmd) ||
    '';
  const result = classify(command);
  if (!result.decision) return null;
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: result.decision,
      permissionDecisionReason:
        `[licensed-to-fix:${result.rule.id}] ${result.rule.reason}` +
        (result.decision === 'deny'
          ? ' Do not try another syntax, encoding, alias or tool to reach the same effect.'
          : ' Approve only if you understand the change and have a way to undo it.'),
    },
  };
}

async function main() {
  let raw = '';
  try {
    raw = await readStdin();
  } catch (err) {
    process.stderr.write(`ltf-pre-tool-guard: failed to read stdin: ${err.message}\n`);
    process.exit(1);
  }
  let payload;
  try {
    payload = JSON.parse(raw || '{}');
  } catch (err) {
    process.stderr.write(`ltf-pre-tool-guard: invalid JSON: ${err.message}\n`);
    process.exit(1);
  }
  const decision = decide(payload);
  if (decision) {
    process.stdout.write(JSON.stringify(decision));
  }
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = { decide };
