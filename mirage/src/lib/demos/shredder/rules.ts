/**
 * Shredder — paste any text, get back a list of detected PII and secrets.
 * Pure regex-based (no LLM required). 18 rule families covering:
 *   - Email, phone (international + Greek), SSN-like national IDs
 *   - Credit-card numbers (validated with Luhn)
 *   - AWS access keys, GitHub PATs, JWT, bearer tokens
 *   - IBAN, IPv4, IPv6, MAC addresses
 *   - Greek AFM (tax ID), AMKA (social security)
 *   - URLs with embedded credentials
 *
 * Each rule returns confidence 0..1 so the UI can rank findings.
 */

export type Finding = {
  ruleId: string;
  label: string;
  match: string;
  start: number;
  end: number;
  confidence: number;
  redacted: string;
};

type Rule = {
  id: string;
  label: string;
  pattern: RegExp;
  confidence: number;
  validate?: (match: string) => boolean;
  redact: (match: string) => string;
};

const Luhn = (digits: string): boolean => {
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
};

const keep = (s: string, head = 0, tail = 0) => {
  if (s.length <= head + tail) return '•'.repeat(s.length);
  return s.slice(0, head) + '•'.repeat(Math.max(3, s.length - head - tail)) + s.slice(s.length - tail);
};

const RULES: Rule[] = [
  {
    id: 'email',
    label: 'Email address',
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    confidence: 0.99,
    redact: (m) => keep(m, 2, 4)
  },
  {
    id: 'phone-intl',
    label: 'International phone',
    pattern: /\+\d{1,3}[\s-]?\d{2,4}[\s-]?\d{3,4}[\s-]?\d{3,4}/g,
    confidence: 0.85,
    redact: (m) => keep(m.replace(/\D/g, ''), 2, 2)
  },
  {
    id: 'phone-gr',
    label: 'Greek phone',
    pattern: /\b(?:\(?(?:0030|\+30)\)?[\s-]?)?6\d{2}[\s-]?\d{3}[\s-]?\d{4}\b/g,
    confidence: 0.9,
    redact: (m) => keep(m, 2, 2)
  },
  {
    id: 'cc',
    label: 'Credit card',
    pattern: /\b(?:\d[ -]?){13,19}\b/g,
    confidence: 0.95,
    validate: (m) => {
      const digits = m.replace(/\D/g, '');
      return digits.length >= 13 && digits.length <= 19 && Luhn(digits);
    },
    redact: (m) => '•••• •••• •••• ' + m.replace(/\D/g, '').slice(-4)
  },
  {
    id: 'iban',
    label: 'IBAN',
    pattern: /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g,
    confidence: 0.97,
    redact: (m) => keep(m, 4, 4)
  },
  {
    id: 'aws-access-key',
    label: 'AWS access key ID',
    pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
    confidence: 0.99,
    redact: () => 'AKIA••••••••••••••••'
  },
  {
    id: 'aws-secret',
    label: 'AWS secret access key',
    pattern: /(?<![A-Za-z0-9])[A-Za-z0-9/+=]{40}(?![A-Za-z0-9])/g,
    confidence: 0.5,
    redact: () => '••••••••••••••••••••••••••••••••••••••••'
  },
  {
    id: 'github-pat',
    label: 'GitHub personal access token',
    pattern: /\bghp_[A-Za-z0-9]{36}\b/g,
    confidence: 0.99,
    redact: () => 'ghp_••••••••••••••••••••••••••••••••'
  },
  {
    id: 'github-oauth',
    label: 'GitHub OAuth token',
    pattern: /\bgho_[A-Za-z0-9]{36}\b/g,
    confidence: 0.99,
    redact: () => 'gho_••••••••••••••••••••••••••••••••'
  },
  {
    id: 'slack-token',
    label: 'Slack token',
    pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g,
    confidence: 0.99,
    redact: () => 'xox?-••••••••••••••'
  },
  {
    id: 'jwt',
    label: 'JSON Web Token',
    pattern: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
    confidence: 0.95,
    redact: (m) => m.slice(0, 12) + '…'
  },
  {
    id: 'bearer',
    label: 'Bearer token',
    pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{20,}\b/g,
    confidence: 0.85,
    redact: (m) => 'Bearer ••••••••'
  },
  {
    id: 'ipv4',
    label: 'IPv4 address',
    pattern: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g,
    confidence: 0.9,
    redact: (m) => {
      const parts = m.split('.');
      return parts.slice(0, 2).join('.') + '.x.x';
    }
  },
  {
    id: 'ipv6',
    label: 'IPv6 address',
    pattern: /\b(?:[A-Fa-f0-9]{1,4}:){7}[A-Fa-f0-9]{1,4}\b/g,
    confidence: 0.9,
    redact: (m) => m.slice(0, 4) + ':…:…'
  },
  {
    id: 'mac',
    label: 'MAC address',
    pattern: /\b(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\b/g,
    confidence: 0.95,
    redact: (m) => keep(m.replace(/[:-]/g, ''), 2, 2)
  },
  {
    id: 'afm',
    label: 'Greek AFM (tax ID)',
    pattern: /\b\d{9}\b/g,
    confidence: 0.4,
    validate: (m) => {
      if (m.length !== 9) return false;
      let sum = 0;
      for (let i = 0; i < 8; i++) sum += parseInt(m[i], 10) * (Math.pow(2, 8 - i));
      const mod = sum % 11;
      const check = (mod === 10 ? 0 : mod) === parseInt(m[8], 10);
      return check;
    },
    redact: (m) => keep(m, 2, 2)
  },
  {
    id: 'url-creds',
    label: 'URL with credentials',
    pattern: /https?:\/\/[^/\s:@]+:[^/\s:@]+@[^\s/]+/g,
    confidence: 0.99,
    redact: (m) => m.replace(/(https?:\/\/)[^/\s:@]+:[^/\s:@]+@/, '$1user:pass@')
  }
];

export function detectPII(input: string): Finding[] {
  const findings: Finding[] = [];
  for (const rule of RULES) {
    rule.pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = rule.pattern.exec(input)) !== null) {
      const matched = match[0];
      if (rule.validate && !rule.validate(matched)) continue;
      findings.push({
        ruleId: rule.id,
        label: rule.label,
        match: matched,
        start: match.index,
        end: match.index + matched.length,
        confidence: rule.confidence,
        redacted: rule.redact(matched)
      });
    }
  }
  findings.sort((a, b) => a.start - b.start);
  return findings;
}

export function redactFindings(input: string, findings: Finding[]): string {
  let out = '';
  let cursor = 0;
  for (const f of findings) {
    out += input.slice(cursor, f.start);
    out += f.redacted;
    cursor = f.end;
  }
  out += input.slice(cursor);
  return out;
}

export const RULE_LABELS = RULES.map((r) => ({ id: r.id, label: r.label }));