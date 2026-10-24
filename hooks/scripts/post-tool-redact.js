#!/usr/bin/env node
'use strict';
/**
 * PostToolUse hook: replace Bash/PowerShell tool output with a redacted copy
 * via updatedToolOutput, so identifiers never reach the model.
 *
 * Documented capability (hooks reference, PostToolUse decision control):
 *   updatedToolOutput replaces the tool's result before it is sent to Claude.
 *   The value must match the tool's output shape
 *   ({ stdout, stderr, interrupted, isImage } for Bash/PowerShell).
 *
 * Limitations (documented in COMPLIANCE.md and README):
 * 1. PostToolUse fires only after a successful tool run. Failed commands
 *    fire PostToolUseFailure, which has no updatedToolOutput field — only
 *    additionalContext. For failures, use the Invoke-Redacted.ps1 wrapper
 *    so redaction happens at the source, or accept that failure text may
 *    still contain identifiers (we still try to append a redacted preview
 *    via additionalContext).
 * 2. Telemetry / OpenTelemetry spans capture the original output before
 *    the hook runs.
 * 3. A replacement that doesn't match the tool's schema is ignored.
 */

const { redact, redactToolResponse } = require('./redact');

function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => chunks.push(c));
    process.stdin.on('end', () => resolve(chunks.join('')));
    process.stdin.on('error', reject);
  });
}

function normalizeBashShape(toolResponse) {
  // Accept the documented shape, or a plain string, and always return the
  // Bash/PowerShell shape so Claude Code doesn't discard the rewrite.
  if (toolResponse && typeof toolResponse === 'object') {
    return {
      stdout: typeof toolResponse.stdout === 'string' ? toolResponse.stdout : '',
      stderr: typeof toolResponse.stderr === 'string' ? toolResponse.stderr : '',
      interrupted: Boolean(toolResponse.interrupted),
      isImage: Boolean(toolResponse.isImage),
    };
  }
  if (typeof toolResponse === 'string') {
    return { stdout: toolResponse, stderr: '', interrupted: false, isImage: false };
  }
  return { stdout: '', stderr: '', interrupted: false, isImage: false };
}

function buildPostToolUse(payload) {
  const tool = payload && payload.tool_name;
  if (tool !== 'Bash' && tool !== 'PowerShell') return null;
  const shaped = normalizeBashShape(payload.tool_response);
  const { response, count } = redactToolResponse(shaped);
  if (count === 0) return null;
  return {
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      updatedToolOutput: response,
      additionalContext:
        `Licensed to Fix redacted ${count} identifier(s) from this tool result before it reached the model.`,
    },
  };
}

function buildPostToolUseFailure(payload) {
  // PostToolUseFailure cannot replace output. Best available mechanism:
  // put a redacted preview in additionalContext so Claude at least sees
  // a safe copy alongside the original error string.
  const tool = payload && payload.tool_name;
  if (tool !== 'Bash' && tool !== 'PowerShell') return null;
  const err = typeof payload.error === 'string' ? payload.error : '';
  if (!err) return null;
  const { text, count } = redact(err);
  if (count === 0) return null;
  return {
    hookSpecificOutput: {
      hookEventName: 'PostToolUseFailure',
      additionalContext:
        `Licensed to Fix note: the failure text above may contain identifiers. Redacted preview (${count} replacement(s)):\n${text}`,
    },
  };
}

async function main() {
  let raw = '';
  try {
    raw = await readStdin();
  } catch (err) {
    process.stderr.write(`ltf-post-tool-redact: stdin: ${err.message}\n`);
    process.exit(1);
  }
  let payload;
  try {
    payload = JSON.parse(raw || '{}');
  } catch (err) {
    process.stderr.write(`ltf-post-tool-redact: JSON: ${err.message}\n`);
    process.exit(1);
  }
  const event = payload.hook_event_name;
  let out = null;
  if (event === 'PostToolUseFailure') {
    out = buildPostToolUseFailure(payload);
  } else {
    out = buildPostToolUse(payload);
  }
  if (out) process.stdout.write(JSON.stringify(out));
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = { buildPostToolUse, buildPostToolUseFailure, normalizeBashShape };
