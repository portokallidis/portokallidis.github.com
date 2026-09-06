import { describe, expect, it } from 'vitest';
import { projects } from '../src/content';
import { parseDomain, safeUrl, validateProjects } from '../src/validation';

describe('public content boundary', () => {
  it('accepts the approved portfolio and preserves historical dates', () => {
    expect(() => validateProjects(projects)).not.toThrow();
    expect(projects.filter(project => project.featured).map(project => project.slug)).toEqual(['sylva', 'carre', 'thrombus-plus']);
    expect(projects.find(project => project.slug === 'thrombus-plus')?.dateLabel).toBe('Start: 2024');
  });
  it('rejects duplicate slugs, unapproved claims, inferred Present dates, and unsafe Markdown links', () => {
    expect(() => validateProjects([...projects, projects[0]])).toThrow();
    expect(() => validateProjects([{ ...projects[0], dateLabel: '2017-Present' }])).toThrow();
    expect(() => validateProjects([{ ...projects[0], approval: { ...projects[0].approval, reference: '' } }])).toThrow();
    expect(() => validateProjects([{ ...projects[0], body: '[bad](javascript:alert)' }])).toThrow();
  });
  it('validates query parameters and link schemes', () => {
    expect(parseDomain('Healthcare')).toBe('Healthcare');
    expect(parseDomain('<script>')).toBe('All');
    expect(parseDomain(null)).toBe('All');
    expect(safeUrl('https://github.com/portokallidis')).toBe(true);
    for (const bad of ['javascript:alert(1)', '//evil.test', '/\\evil.test', 'data:text/html,bad']) expect(safeUrl(bad)).toBe(false);
  });
});
