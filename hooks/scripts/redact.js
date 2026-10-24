'use strict';
/**
 * Redact PC identifiers from text before it reaches the model.
 * Uses only synthetic placeholders. Stable hashes keep the same
 * real value mapped to the same token within one process.
 */

const crypto = require('crypto');

function tag(kind, value) {
  const h = crypto.createHash('sha256').update(String(value).toLowerCase()).digest('hex').slice(0, 4);
  return `<${kind}#${h}>`;
}

const WELL_KNOWN_DOMAINS = new Set([
  'hklm', 'hkcu', 'hkcr', 'hku', 'hkcc', 'hkey_local_machine', 'hkey_current_user',
  'hkey_classes_root', 'hkey_users', 'hkey_current_config',
  'system', 'software', 'hardware', 'sam', 'security', 'builtin',
  'nt authority', 'everyone', 'nt service', 'application packages',
  'users', 'windows', 'program files', 'program files (x86)', 'programdata',
  'documents', 'desktop', 'downloads', 'appdata', 'local', 'roaming', 'temp',
  'microsoft', 'wow6432node', 'currentversion', 'run', 'runonce',
]);

const WELL_KNOWN_USERS = new Set([
  'system', 'local service', 'network service', 'administrator', 'guest',
  'defaultaccount', 'wdagutilityaccount', 'trustedinstaller',
]);

/**
 * Redact identifiers in `text`. Returns { text, count }.
 * Order matters: longer / more specific patterns first.
 */
function redact(text) {
  if (typeof text !== 'string' || text.length === 0) {
    return { text: text == null ? text : String(text), count: 0 };
  }
  let out = text;
  let count = 0;
  const bump = (n) => { count += n; };

  // Product keys (XXXXX-XXXXX-XXXXX-XXXXX-XXXXX)
  out = out.replace(/\b([A-Z0-9]{5}-){4}[A-Z0-9]{5}\b/g, (m) => {
    bump(1); return tag('PRODUCT-KEY', m);
  });

  // SIDs
  out = out.replace(/\bS-1-\d+(?:-\d+){2,}\b/g, (m) => {
    bump(1); return tag('SID', m);
  });

  // MAC addresses BEFORE IPv6 (aa:bb:cc:dd:ee:ff looks like a short IPv6)
  out = out.replace(
    /\b(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\b/g,
    (m) => { bump(1); return tag('MAC', m); }
  );

  // IPv6: standard forms, including compressed. Avoid matching after we already
  // replaced MACs. Require either :: or at least three groups.
  out = out.replace(
    /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b|\b(?:[0-9a-fA-F]{1,4}:){1,7}:[0-9a-fA-F]{0,4}\b|\b:(?::[0-9a-fA-F]{1,4}){1,7}\b/g,
    (m) => {
      if (m === '::' || m.length < 4) return m;
      bump(1); return tag('IPv6', m);
    }
  );

  // IPv4
  out = out.replace(
    /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g,
    (m) => {
      if (m === '0.0.0.0' || m === '127.0.0.1' || m === '255.255.255.255') return m;
      const priv = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/.test(m);
      bump(1); return tag(priv ? 'IPv4:private' : 'IPv4', m);
    }
  );

  // Emails
  out = out.replace(
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    (m) => { bump(1); return tag('EMAIL', m); }
  );

  // User profile paths: C:\Users\<name>\... and /Users/<name>/... and /home/<name>/...
  out = out.replace(
    /\b([A-Za-z]:\\Users\\)([^\\\/\s"']+)/gi,
    (_, pfx, name) => { bump(1); return pfx + tag('USER', name); }
  );
  out = out.replace(
    /(\/Users\/)([^\/\s"']+)/g,
    (_, pfx, name) => {
      if (name === 'Shared' || name === 'Guest') return pfx + name;
      bump(1); return pfx + tag('USER', name);
    }
  );
  out = out.replace(
    /(\/home\/)([^\/\s"']+)/g,
    (_, pfx, name) => { bump(1); return pfx + tag('USER', name); }
  );

  // Domain\user — skip registry hives, well-known path segments, and already-tagged text
  out = out.replace(
    /\b([A-Za-z0-9_][A-Za-z0-9_.-]{0,30})\\([A-Za-z0-9_][A-Za-z0-9_.-]{0,63})\b/g,
    (m, dom, user) => {
      if (dom.startsWith('<') || user.startsWith('<')) return m;
      if (WELL_KNOWN_DOMAINS.has(dom.toLowerCase())) return m;
      if (/^[A-Za-z]:$/.test(dom)) return m; // drive letter leftovers
      bump(1); return tag('DOMAIN', dom) + '\\' + tag('USER', user);
    }
  );

  // Serial numbers (common vendor patterns)
  out = out.replace(
    /\b(?:Serial(?:\s*Number)?|Service\s*Tag|S\/N)\s*[:=]\s*([A-Za-z0-9-]{6,})\b/gi,
    (m, sn) => { bump(1); return m.replace(sn, tag('SERIAL', sn)); }
  );

  // Computer names after common labels
  out = out.replace(
    /\b(?:ComputerName|Host Name|Hostname|CSName|MachineName)\s*[:=]\s*([A-Za-z0-9][A-Za-z0-9_-]{1,62})\b/gi,
    (m, name) => { bump(1); return m.replace(name, tag('COMPUTER', name)); }
  );

  // User names after common labels
  out = out.replace(
    /\b(?:UserName|User Name|USERNAME|Logged on user|Account Name)\s*[:=]\s*([A-Za-z0-9][A-Za-z0-9._-]{1,63})\b/gi,
    (m, name) => {
      if (WELL_KNOWN_USERS.has(name.toLowerCase())) return m;
      bump(1); return m.replace(name, tag('USER', name));
    }
  );

  // Bare hostname-looking tokens DESKTOP-XXXX / LAPTOP-XXXX
  out = out.replace(
    /\b(?:DESKTOP|LAPTOP|WIN|PC)-[A-Z0-9]{4,}\b/gi,
    (m) => { bump(1); return tag('COMPUTER', m); }
  );

  return { text: out, count };
}

function redactToolResponse(toolResponse) {
  if (!toolResponse || typeof toolResponse !== 'object') {
    if (typeof toolResponse === 'string') {
      return { response: redact(toolResponse).text, count: redact(toolResponse).count };
    }
    return { response: toolResponse, count: 0 };
  }
  const out = { ...toolResponse };
  let total = 0;
  for (const key of ['stdout', 'stderr', 'output', 'content', 'result', 'error']) {
    if (typeof out[key] === 'string') {
      const r = redact(out[key]);
      out[key] = r.text;
      total += r.count;
    }
  }
  return { response: out, count: total };
}

module.exports = { redact, redactToolResponse, tag };
