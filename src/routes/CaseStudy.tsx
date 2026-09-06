import Markdown from 'react-markdown';
import { Link } from 'react-router';
import { projects } from '../content';
import { Arrow, Contact } from '../components/Shared';
import NotFound from './NotFound';

export function headingId(text: string) { return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
export default function CaseStudy({ slug }: { slug: string }) {
  const project = projects.find(item => item.slug === slug && item.featured);
  if (!project) return <NotFound />;
  const featured = projects.filter(item => item.featured);
  const next = featured[(featured.indexOf(project) + 1) % featured.length];
  return <><header className="case-intro"><Link className="back-link" to="/work">← All work</Link><p className="eyebrow">{project.name} / {project.domain}</p><h1>{project.title}</h1><p className="case-summary">{project.summary}</p><dl className="case-facts"><div><dt>Contribution</dt><dd>{project.role}</dd></div><div><dt>Period</dt><dd>{project.dateLabel}</dd></div><div><dt>Field</dt><dd>{project.classification === 'research' ? 'Research' : 'Professional work'}</dd></div></dl></header><div className="case-body-layout"><aside><p className="eyebrow">In this contribution</p><nav aria-label="Case study sections">{[...project.body.matchAll(/^## (.+)$/gm)].map(match => <a key={match[1]} href={`#${headingId(match[1])}`}>{match[1]}</a>)}</nav></aside><article className="prose"><Markdown skipHtml components={{ h2: ({ children }) => <h2 id={headingId(String(children))}>{children}</h2> }}>{project.body}</Markdown></article></div><div className="next-work"><p className="eyebrow">Continue exploring</p><Link to={`/work/${next.slug}`}>{next.name}<Arrow /></Link></div><Contact /></>;
}
