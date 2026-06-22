/**
 * Auditor — paste code, get security findings back.
 * Pure regex/AST-light — 18 rule families across JS/Python/Go.
 * Each rule has a CWE reference and a severity.
 */

export type Severity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export type AuditFinding = {
  ruleId: string;
  label: string;
  cwe: string;
  severity: Severity;
  line: number;
  column: number;
  match: string;
  snippet: string;
  description: string;
};

type Rule = {
  id: string;
  label: string;
  cwe: string;
  severity: Severity;
  languages: Array<'javascript' | 'typescript' | 'python' | 'go'>;
  pattern: RegExp;
  description: string;
};

const RULES: Rule[] = [
  {
    id: 'innerhtml',
    label: 'Direct innerHTML assignment',
    cwe: 'CWE-79',
    severity: 'high',
    languages: ['javascript', 'typescript'],
    pattern: /\.innerHTML\s*=/g,
    description: 'innerHTML with untrusted input enables XSS. Prefer textContent or a sanitizer.'
  },
  {
    id: 'dangerously-set',
    label: 'dangerouslySetInnerHTML usage',
    cwe: 'CWE-79',
    severity: 'high',
    languages: ['javascript', 'typescript'],
    pattern: /dangerouslySetInnerHTML/g,
    description: 'React prop that injects raw HTML. Audit the source string carefully.'
  },
  {
    id: 'eval',
    label: 'eval() usage',
    cwe: 'CWE-95',
    severity: 'critical',
    languages: ['javascript', 'typescript'],
    pattern: /\beval\s*\(/g,
    description: 'eval runs attacker-controlled strings as code. Almost never safe.'
  },
  {
    id: 'function-constructor',
    label: 'Function() constructor',
    cwe: 'CWE-95',
    severity: 'critical',
    languages: ['javascript', 'typescript'],
    pattern: /\bnew\s+Function\s*\(/g,
    description: 'Function() compiles a string at runtime. Same risk family as eval.'
  },
  {
    id: 'document-write',
    label: 'document.write usage',
    cwe: 'CWE-79',
    severity: 'high',
    languages: ['javascript', 'typescript'],
    pattern: /document\.write(?:ln)?\s*\(/g,
    description: 'document.write injects HTML into the parser. Use DOM APIs instead.'
  },
  {
    id: 'window-open-no-rel',
    label: 'window.open without rel=noopener',
    cwe: 'CWE-1022',
    severity: 'low',
    languages: ['javascript', 'typescript'],
    pattern: /window\.open\s*\(/g,
    description: 'Tabs opened with window.open can manipulate window.opener. Always pass rel=noopener.'
  },
  {
    id: 'crypto-md5',
    label: 'MD5 used for hashing',
    cwe: 'CWE-327',
    severity: 'medium',
    languages: ['javascript', 'typescript'],
    pattern: /crypto\.createHash\s*\(\s*['"]md5['"]\s*\)/g,
    description: 'MD5 is broken for collision resistance. Use SHA-256 or stronger.'
  },
  {
    id: 'crypto-sha1',
    label: 'SHA-1 used for hashing',
    cwe: 'CWE-327',
    severity: 'medium',
    languages: ['javascript', 'typescript'],
    pattern: /crypto\.createHash\s*\(\s*['"]sha1['"]\s*\)/g,
    description: 'SHA-1 is broken for collision resistance. Use SHA-256 or stronger.'
  },
  {
    id: 'math-random-crypto',
    label: 'Math.random for crypto',
    cwe: 'CWE-338',
    severity: 'high',
    languages: ['javascript', 'typescript'],
    pattern: /Math\.random\s*\(\s*\)/g,
    description: 'Math.random is not cryptographically secure. Use crypto.getRandomValues.'
  },
  {
    id: 'hardcoded-secret',
    label: 'Possible hardcoded secret',
    cwe: 'CWE-798',
    severity: 'high',
    languages: ['javascript', 'typescript', 'python', 'go'],
    pattern: /(?:password|secret|api_?key|token)\s*[:=]\s*['"][^'"]{6,}['"]/gi,
    description: 'Hardcoded credentials in source. Use environment variables or a secrets manager.'
  },
  {
    id: 'sql-string-concat',
    label: 'SQL string concatenation',
    cwe: 'CWE-89',
    severity: 'critical',
    languages: ['javascript', 'typescript', 'python', 'go'],
    pattern: /(?:SELECT|INSERT|UPDATE|DELETE)\s+[^;'"]*['"]\s*\+/gi,
    description: 'String-built SQL is vulnerable to injection. Use parameterised queries.'
  },
  {
    id: 'shell-true',
    label: 'subprocess with shell=True',
    cwe: 'CWE-78',
    severity: 'critical',
    languages: ['python'],
    pattern: /subprocess\.[A-Za-z_]+\([^)]*shell\s*=\s*True/gi,
    description: 'shell=True runs commands through a shell. Pass args as a list, never shell=True.'
  },
  {
    id: 'os-system',
    label: 'os.system usage',
    cwe: 'CWE-78',
    severity: 'high',
    languages: ['python'],
    pattern: /\bos\.system\s*\(/g,
    description: 'os.system passes a string to a shell. Use subprocess.run(args=[...]) instead.'
  },
  {
    id: 'yaml-load',
    label: 'yaml.load without SafeLoader',
    cwe: 'CWE-502',
    severity: 'critical',
    languages: ['python'],
    pattern: /yaml\.load\s*\(/g,
    description: 'yaml.load can execute arbitrary Python. Use yaml.safe_load or yaml.load(safe).'
  },
  {
    id: 'pickle-loads',
    label: 'pickle.loads on untrusted input',
    cwe: 'CWE-502',
    severity: 'critical',
    languages: ['python'],
    pattern: /pickle\.loads?\s*\(/g,
    description: 'pickle deserialisation can execute arbitrary code. Use JSON for untrusted data.'
  },
  {
    id: 'exec-py',
    label: 'exec() in Python',
    cwe: 'CWE-95',
    severity: 'critical',
    languages: ['python'],
    pattern: /\bexec\s*\(/g,
    description: 'exec runs attacker-controlled strings as code. Almost never safe.'
  },
  {
    id: 'go-exec',
    label: 'exec.Command with string arg',
    cwe: 'CWE-78',
    severity: 'medium',
    languages: ['go'],
    pattern: /exec\.Command\s*\(\s*"[^"]*"\s*\)/g,
    description: 'exec.Command("sh", "-c", ...) is shell-injection-prone. Prefer named args.'
  },
  {
    id: 'go-template-html',
    label: 'Go html/template used as text/template',
    cwe: 'CWE-79',
    severity: 'medium',
    languages: ['go'],
    pattern: /text\/template/g,
    description: 'text/template does NOT escape HTML. Use html/template for any HTML output.'
  }
];

export function detectLanguage(code: string): 'javascript' | 'typescript' | 'python' | 'go' | 'unknown' {
  const trimmed = code.trim();
  if (/^package\s+\w+|func\s+\w+\s*\(/.test(trimmed)) return 'go';
  if (/^\s*(?:from\s+\w+\s+)?import\s+\w+|def\s+\w+\s*\(|print\s*\(/.test(trimmed)) return 'python';
  if (/\binterface\s+\w+\s*\{|: \w+(\[\])?(\s*=)/.test(trimmed)) return 'typescript';
  if (/=>|const\s+\w+\s*=|function\s+\w+\s*\(/.test(trimmed)) return 'javascript';
  return 'unknown';
}

export function auditCode(code: string): AuditFinding[] {
  const lang = detectLanguage(code);
  const lines = code.split('\n');
  const findings: AuditFinding[] = [];

  for (const rule of RULES) {
    if (lang !== 'unknown' && !rule.languages.includes(lang)) continue;
    if (lang === 'unknown' && rule.languages.length < 3) continue;

    rule.pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = rule.pattern.exec(code)) !== null) {
      const before = code.slice(0, match.index);
      const line = before.split('\n').length;
      const lastNl = before.lastIndexOf('\n');
      const column = match.index - (lastNl + 1) + 1;
      const lineText = lines[line - 1] ?? '';
      findings.push({
        ruleId: rule.id,
        label: rule.label,
        cwe: rule.cwe,
        severity: rule.severity,
        line,
        column,
        match: match[0],
        snippet: lineText.trim(),
        description: rule.description
      });
    }
  }
  findings.sort((a, b) => a.line - b.line || a.column - b.column);
  return findings;
}

export const RULE_LABELS = RULES.map((r) => ({ id: r.id, label: r.label, cwe: r.cwe, severity: r.severity }));