import { about, education, publications } from '../content';
import { displayPreferredName } from '../display-name';
import { Contact, SectionLabel } from '../components/Shared';

export default function About() {
  const recentPublications = [...publications].sort((first, second) => second.year - first.year);
  return <>
    <header className="page-intro"><p className="eyebrow">About Nick Portokallidis</p><h1>Engineering across<br /><span>products and domains.</span></h1><p>{about.intro}</p></header>
    <section id="approach" className="about-body"><SectionLabel>Engineering practice</SectionLabel><div className="prose">{about.paragraphs.map(text => <p key={text}>{text}</p>)}</div></section>
    <section className="section" id="education"><h2>Education</h2><div className="education-list">{education.map(item => <article key={item.title}><span className="mono">{item.dates}</span><div><h3>{item.title}</h3><p>{item.institution}</p></div></article>)}</div></section>
    <section className="section" id="publications">
      <h2>Selected publications</h2>
      <ol className="publication-list">{recentPublications.map(item => <li key={item.title}>
        <span className="mono">{item.year}</span>
        <div>
          <h3>{item.url ? <a href={item.url}>{item.title}<span aria-hidden="true"> ↗</span></a> : item.title}</h3>
          <p>{displayPreferredName(item.authors)}</p>
          <p className="publication-venue">{item.venue}</p>
        </div>
      </li>)}</ol>
    </section>
    <Contact />
  </>;
}
