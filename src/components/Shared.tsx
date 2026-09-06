import { Link } from 'react-router';
import { contact } from '../content';
import type { Project } from '../content/types';

export function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d={diagonal ? 'M6 18 18 6M6 6h12v12' : 'M4 12h15m-6-6 6 6-6 6'} /></svg>;
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="eyebrow section-label">{children}</p>;
}

export function ProjectStory({ project }: { project: Project }) {
  return <article className="project-story">
    <Link className="project-link" to={'/work/' + project.slug} aria-labelledby={`${project.slug}-name ${project.slug}-title`}>
      <div className="project-meta"><p className="project-name" id={`${project.slug}-name`}>{project.name}</p><span>{project.role}<br />{project.dateLabel}</span></div>
      <div className="project-narrative"><span className="project-domain">{project.domain}</span><h3 id={`${project.slug}-title`}>{project.title}</h3><p>{project.contribution}</p></div>
      <span className="project-arrow"><Arrow diagonal /></span>
    </Link>
  </article>;
}

export function Contact() {
  return <section className="contact-section section" id="contact" aria-labelledby="contact-title">
    <div className="contact-grid"><div><h2 id="contact-title">Let’s build something.</h2><p>Have a product to develop or an engineering role to discuss? Get in touch.</p><a className="text-link" href={contact.github}>View GitHub<Arrow diagonal /></a></div><div><p className="contact-name">Nick Portokallidis</p><a className="button" href={'mailto:' + contact.email}>Email me<Arrow diagonal /></a></div></div>
  </section>;
}

export function LabTeaser() {
  return <div className="lab-teaser"><div><p className="eyebrow">Optional experiment</p><h2>Ask about my work</h2><p>Explore my experience with a conversation grounded in this portfolio.</p></div><Link className="text-link" to="/lab/ask-about-my-work">Ask a question<Arrow /></Link></div>;
}
