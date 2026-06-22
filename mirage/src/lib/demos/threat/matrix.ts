/**
 * STRIDE threat matrix generator. Pick an asset + a STRIDE category,
 * get a structured threat list. Used by /threat route.
 *
 * Outputs are deterministic for a given (asset, category) pair so permalinks
 * share the same view.
 */

export const STRIDE = [
  { id: 'S', name: 'Spoofing', description: 'Impersonating a user or system identity.' },
  { id: 'T', name: 'Tampering', description: 'Modifying data or code without authorisation.' },
  { id: 'R', name: 'Repudiation', description: 'Performing an action that cannot be traced back.' },
  { id: 'I', name: 'Information Disclosure', description: 'Exposing information to unauthorised parties.' },
  { id: 'D', name: 'Denial of Service', description: 'Disrupting availability of a service or system.' },
  { id: 'E', name: 'Elevation of Privilege', description: 'Gaining capabilities beyond what was intended.' }
] as const;

export type StrideId = typeof STRIDE[number]['id'];

export const ASSETS = [
  { id: 'web', name: 'Public web app', description: 'Static + SSR content served to anonymous visitors.' },
  { id: 'api', name: 'REST API', description: 'JSON endpoints behind an API gateway.' },
  { id: 'db', name: 'Primary database', description: 'Customer data, audit logs, sessions.' },
  { id: 'auth', name: 'Auth service', description: 'OAuth2 / OIDC provider + session store.' },
  { id: 'queue', name: 'Async queue', description: 'Background jobs and event bus.' },
  { id: 'ml', name: 'ML inference service', description: 'Model serving, prompt and response logs.' },
  { id: 'cdn', name: 'CDN edge', description: 'Static asset distribution.' },
  { id: 'browser', name: 'Client browser', description: 'User device running the web app.' }
] as const;

export type AssetId = typeof ASSETS[number]['id'];

export type Threat = {
  id: string;
  stride: StrideId;
  asset: AssetId;
  title: string;
  description: string;
  attackVector: string;
  mitigation: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
};

const SEED = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 0xffffffff;
};

const pick = <T>(arr: readonly T[], seed: number): T => arr[Math.floor(seed * arr.length) % arr.length];

const TEMPLATES: Record<StrideId, Array<(asset: typeof ASSETS[number]) => Omit<Threat, 'id' | 'stride' | 'asset'>>> = {
  S: [
    (a) => ({
      title: `Credential reuse on ${a.name}`,
      description: 'An attacker reuses credentials harvested from a third-party breach.',
      attackVector: 'Credential stuffing against the public login surface.',
      mitigation: 'Enforce passkeys or TOTP MFA; subscribe to HIBP and force password resets on known leaks.',
      severity: 'high'
    }),
    (a) => ({
      title: `Session-token forgery against ${a.name}`,
      description: 'Weak session-token generation allows an attacker to forge valid tokens.',
      attackVector: 'Exploit low-entropy or predictable session IDs.',
      mitigation: 'Use 128-bit CSPRNG tokens, rotate on auth, set HttpOnly+Secure+SameSite cookies.',
      severity: 'critical'
    }),
    (a) => ({
      title: `OAuth flow phishing via ${a.name}`,
      description: 'Attacker registers a malicious OAuth client or relays the auth flow.',
      attackVector: 'OAuth consent phishing using a lookalike client_id.',
      mitigation: 'Restrict allowed redirect URIs strictly; display the full redirect chain to the user.',
      severity: 'medium'
    })
  ],
  T: [
    (a) => ({
      title: `Parameter tampering against ${a.name}`,
      description: 'Attacker modifies request parameters to escalate privileges or alter state.',
      attackVector: 'Manipulate hidden form fields, query parameters, or headers.',
      mitigation: 'Re-validate every parameter server-side; never trust client-supplied user IDs.',
      severity: 'high'
    }),
    (a) => ({
      title: `Stored XSS via ${a.name}`,
      description: 'Attacker injects script that runs in other users\u2019 sessions.',
      attackVector: 'Submit crafted payload through any user-input field.',
      mitigation: 'Output-encode on render; use CSP with nonces; sanitise HTML on input.',
      severity: 'high'
    }),
    (a) => ({
      title: `Cache poisoning on ${a.name}`,
      description: 'Attacker pollutes shared cache keys to serve malicious responses.',
      attackVector: 'Trigger cache writes with attacker-controlled Vary headers or query params.',
      mitigation: 'Strict cache keys; ignore client-supplied Vary headers; signed responses.',
      severity: 'medium'
    })
  ],
  R: [
    (a) => ({
      title: `Action without audit trail on ${a.name}`,
      description: 'Critical actions leave no durable record.',
      attackVector: 'Abuse sensitive endpoints where logging is broken or disabled.',
      mitigation: 'Append-only audit log; integrity-check with signed Merkle root.',
      severity: 'medium'
    }),
    (a) => ({
      title: `Log injection in ${a.name}`,
      description: 'Attacker injects newlines into log entries to forge history.',
      attackVector: 'Submit input containing \\r\\n sequences that become fake log lines.',
      mitigation: 'Encode control chars on log write; ship logs to a write-once store.',
      severity: 'low'
    })
  ],
  I: [
    (a) => ({
      title: `PII leak via ${a.name}`,
      description: 'Sensitive data exposed in responses or logs.',
      attackVector: 'IDOR, verbose error messages, or logging request bodies.',
      mitigation: 'Response allow-list; mask PII in logs; per-user object-level authz.',
      severity: 'high'
    }),
    (a) => ({
      title: `Side-channel via timing on ${a.name}`,
      description: 'Response time reveals information about valid identifiers.',
      attackVector: 'Measure response time differences for valid vs invalid IDs.',
      mitigation: 'Constant-time comparison and uniform response timing for all paths.',
      severity: 'low'
    }),
    (a) => ({
      title: `Inference data exfil from ${a.name}`,
      description: 'Sensitive prompts or responses leak from an ML service.',
      attackVector: 'Compromise log storage; or use a model inversion attack.',
      mitigation: 'No logging of prompt/response bodies; aggregate metrics only.',
      severity: 'critical'
    })
  ],
  D: [
    (a) => ({
      title: `Resource exhaustion on ${a.name}`,
      description: 'Unbounded request sizes or counts cause the service to exhaust memory or CPU.',
      attackVector: 'Flood with large payloads or expensive operations.',
      mitigation: 'Per-tenant rate limits; payload size caps; timeouts on all downstream calls.',
      severity: 'high'
    }),
    (a) => ({
      title: `Slowloris-style stall on ${a.name}`,
      description: 'Half-open connections exhaust the connection pool.',
      attackVector: 'Open sockets, dribble data slowly.',
      mitigation: 'Connection deadlines; read-timeouts; HTTP/2 stream timeouts.',
      severity: 'medium'
    })
  ],
  E: [
    (a) => ({
      title: `Privilege escalation through ${a.name}`,
      description: 'Low-privileged user gains admin via a misconfigured permission grant.',
      attackVector: 'Modify own role field in a PATCH /users/:id request.',
      mitigation: 'Never accept role/permission fields from the client; centralise authz checks.',
      severity: 'critical'
    }),
    (a) => ({
      title: `Container escape from ${a.name}`,
      description: 'Kernel or runtime bug lets a process escape its container.',
      attackVector: 'Exploit a known CVE in the container runtime.',
      mitigation: 'Patch aggressively; drop unnecessary capabilities; read-only root FS.',
      severity: 'high'
    }),
    (a) => ({
      title: `SSRF via ${a.name}`,
      description: 'Attacker forces ${a.name} to fetch internal URLs.',
      attackVector: 'Submit a URL in a fetch parameter that points to 169.254.169.254 or internal services.',
      mitigation: 'Resolve and validate IPs against a deny-list before fetching; disable redirects.',
      severity: 'high'
    })
  ]
};

export function generateThreats(asset: AssetId, stride: StrideId): Threat[] {
  const a = ASSETS.find((x) => x.id === asset) as typeof ASSETS[number] | undefined;
  if (!a) return [];
  const templates = TEMPLATES[stride];
  return templates.map((tpl, i) => {
    const threat = tpl(a);
    const idSeed = SEED(`${asset}:${stride}:${i}`);
    return {
      id: `${asset}-${stride}-${i}-${Math.floor(idSeed * 1e6).toString(36)}`,
      stride,
      asset,
      ...threat
    };
  });
}

export function strideById(id: string): typeof STRIDE[number] | undefined {
  return STRIDE.find((s) => s.id === id);
}

export function assetById(id: string): typeof ASSETS[number] | undefined {
  return ASSETS.find((a) => a.id === id);
}