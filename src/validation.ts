import type { Project } from './content/types';

export const domains = ['All', 'Education', 'Healthcare', 'Sustainability', 'SaaS', 'Media', 'Workplace'] as const;
export function parseDomain(value: string | null): string { return domains.some(domain => domain === value) ? value! : 'All'; }
export function safeUrl(value: string) {
  // eslint-disable-next-line no-control-regex -- Reject URL control characters at the content boundary.
  if (/[\u0000-\u0020]/.test(value)) return false;
  if (value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')) return true;
  try { const url = new URL(value); return ['https:', 'mailto:'].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
}
export function validateProjects(projects: Project[]) {
  const seen = new Set<string>();
  for (const project of projects) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(project.slug) || seen.has(project.slug)) throw new Error(`Duplicate or invalid slug: ${project.slug}`);
    seen.add(project.slug);
    if (project.approval.status !== 'approved' || !project.approval.reference || !/^\d{4}-\d{2}-\d{2}$/.test(project.approval.date) || !project.sourceReference) throw new Error(`Missing approval/source: ${project.slug}`);
    if (!project.summary.trim() || !project.role.trim() || (project.featured && !project.body.trim())) throw new Error(`Incomplete contribution: ${project.slug}`);
    if (!Number.isInteger(project.start) || project.start < 1900 || (project.end !== null && (!Number.isInteger(project.end) || project.end < project.start))) throw new Error(`Invalid dates: ${project.slug}`);
    if (/\bpresent\b/i.test(project.dateLabel)) throw new Error(`Unconfirmed current status: ${project.slug}`);
    for (const link of project.body.matchAll(/\]\(([^)]+)\)/g)) if (!safeUrl(link[1])) throw new Error(`Unsafe content link: ${project.slug}`);
  }
}
