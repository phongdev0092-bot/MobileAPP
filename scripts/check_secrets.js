#!/usr/bin/env node
/**
 * scripts/check_secrets.js — Quét bí mật cứng & chống lưu mật khẩu plaintext trong MobileApp.
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

const RULES = [
  {
    name: 'POSTGRES_URL_WITH_PASSWORD',
    re: /postgres(?:ql)?(?:\+\w+)?:\/\/[^:\s'"]+:[^@\s'"]+@/i,
  },
  {
    name: 'SUPABASE_KEY_LITERAL',
    re: /sb_(?:publishable|secret)_[A-Za-z0-9_-]{12,}/,
  },
  {
    name: 'PRIVATE_KEY_HEADER',
    re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  },
  {
    name: 'PLAINTEXT_PASSWORD_STORAGE',
    re: /AsyncStorage\.setItem\([^)]*STORAGE_LOCAL_PASS_PREFIX|JSON\.stringify\(\s*\{[^}]*\bpassword\s*:/,
  },
  {
    name: 'SENSITIVE_AUTH_CONSOLE_LOG',
    re: /console\.(?:log|info|debug|warn|error)\([^)]*\b(?:password|newPassword|currentPassword|oldPassword)\b/i,
  },
];

const SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  '.expo',
  'dist',
  'web-build',
  'build',
  '.gradle',
  'graphify-out',
  '.npm-cache',
]);

const SKIP_FILES = new Set(['package-lock.json', 'check_secrets.js']);

const BINARY_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.svg',
  '.ttf', '.otf', '.woff', '.woff2', '.apk', '.aab', '.jar',
  '.keystore', '.jks', '.p12', '.zip', '.gz', '.zst',
]);

function walk(dir, findings) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(ent.name)) continue;
      walk(full, findings);
    } else if (ent.isFile()) {
      if (SKIP_FILES.has(ent.name)) continue;
      if (BINARY_EXTS.has(path.extname(ent.name).toLowerCase())) continue;
      let content;
      try {
        content = fs.readFileSync(full, 'utf8');
      } catch {
        continue;
      }
      const lines = content.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        for (const rule of RULES) {
          if (rule.re.test(lines[i])) {
            findings.push({
              file: path.relative(ROOT, full),
              line: i + 1,
              rule: rule.name,
            });
          }
        }
      }
    }
  }
}

const findings = [];
walk(ROOT, findings);

if (findings.length > 0) {
  console.error(`[FAIL] Phát hiện ${findings.length} vi phạm bảo mật:`);
  for (const f of findings) {
    console.error(`  - [${f.rule}] ${f.file}:${f.line}`);
  }
  process.exit(1);
}

console.log('[OK] Không phát hiện lưu mật khẩu plaintext hoặc khóa bí mật trong MobileApp.');
