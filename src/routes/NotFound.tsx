import { Link } from 'react-router';
import { Arrow } from '../components/Shared';

export default function NotFound() {
  return <section className="not-found"><p className="eyebrow">404 / Page not found</p><h1>A path<br /><span>not taken.</span></h1><p>This page doesn’t exist, or its address has changed.<br />There’s still plenty of work to explore.</p><div className="inline-links"><Link className="button" to="/work">Explore selected work<Arrow /></Link><Link className="text-link" to="/">Back to home<Arrow /></Link></div></section>;
}
