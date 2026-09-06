import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { projects } from '../content';
import { Contact, ProjectStory } from '../components/Shared';
import { parseDomain, domains } from '../validation';

export default function Work() {
  const [params, setParams] = useSearchParams();
  const [domain, setDomain] = useState('All');
  useEffect(() => setDomain(parseDomain(params.get('domain'))), [params]);
  const filtered = projects.filter(project => domain === 'All' || project.domain === domain);
  return <><header className="page-intro"><p className="eyebrow">The work</p><h1>Projects and<br /><span>contributions.</span></h1><p>Product development, technical leadership, and healthcare research. Choose a domain or explore the full list.</p></header><div className="filter-bar"><label htmlFor="domain-filter">Filter by domain</label><select id="domain-filter" aria-label="Domain" value={domain} onChange={event => { const next = parseDomain(event.target.value); setDomain(next); setParams(next === 'All' ? {} : { domain: next }); }}>{domains.map(item => <option key={item}>{item}</option>)}</select><p role="status">{filtered.length} projects</p></div><noscript><p>All projects are shown. Domain filtering requires JavaScript.</p></noscript><section className="work-results" aria-label="Project contributions"><h2 className="visually-hidden">Project contributions</h2>{filtered.filter(project => project.featured).map(project => <ProjectStory key={project.slug} project={project} />)}<div className="small-projects">{filtered.filter(project => !project.featured).map(project => <article className="small-project" key={project.slug} id={project.slug}><div><p className="eyebrow">{project.domain} / {project.dateLabel}</p><h2>{project.name}</h2><p className="muted">{project.role}</p></div><div><p>{project.summary}</p><details><summary>Contribution & technologies</summary><p>{project.contribution}</p><p className="technology-list">{project.technologies.join(' · ')}</p></details></div></article>)}</div></section><Contact /></>;
}
