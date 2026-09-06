import { Link } from 'react-router';
import { projects } from '../content';
import { Arrow, Contact, LabTeaser, ProjectStory } from '../components/Shared';

export default function Home() {
  return <>
    <section className="hero" aria-labelledby="hero-title">
      <p className="eyebrow role-label">Software Engineer</p>
      <h1 id="hero-title">From idea to<br /><span>working product.</span></h1>
      <p className="hero-description">Architecture and hands-on development, with experience in technical leadership, MVP delivery, and healthcare informatics.</p>
      <div className="hero-actions"><a className="button" href="#selected-work">View my work<Arrow /></a><a className="button button-secondary" href="/#contact">Get in touch<Arrow diagonal /></a></div>
      <div className="experience-proof" aria-label="Experience highlights">
        {projects.filter(project => ['sylva', 'culcha'].includes(project.slug)).map(project => <Link className="proof-item" key={project.slug} to={project.featured ? '/work/' + project.slug : '/work#' + project.slug}><div><span className="proof-meta">{project.name} <span>{project.dateLabel}</span></span><strong>{project.slug === 'sylva' ? 'Technical leadership & architecture' : 'Prototyping through MVP launch'}</strong></div><Arrow /></Link>)}
      </div>
    </section>
    <section className="section selected-work" id="selected-work" aria-labelledby="selected-work-title">
      <div className="section-heading"><div><h2 id="selected-work-title">Selected work</h2><p>Product engineering, technical leadership, and healthcare research.</p></div><Link className="text-link" to="/work">All {projects.length} projects<Arrow /></Link></div>
      <div className="project-list">{projects.filter(project => project.featured).map(project => <ProjectStory key={project.slug} project={project} />)}</div>
    </section>
    <Contact />
    <section className="lab-home" aria-label="Personal experiment"><LabTeaser /></section>
  </>;
}
