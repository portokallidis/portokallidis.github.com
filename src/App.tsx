import { lazy, Suspense, useEffect, useRef } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigationType } from 'react-router';
import { contact } from './content';
import { notFoundMeta, routeManifest, siteOrigin } from './route-manifest';
import { registerPortfolioTools } from './webmcp';

const Home = lazy(() => import('./routes/Home'));
const Work = lazy(() => import('./routes/Work'));
const CaseStudy = lazy(() => import('./routes/CaseStudy'));
const About = lazy(() => import('./routes/About'));
const Ask = lazy(() => import('./routes/Ask'));
const Privacy = lazy(() => import('./routes/Privacy'));
const NotFound = lazy(() => import('./routes/NotFound'));

function NavigationEffects() {
  const location = useLocation();
  const type = useNavigationType();
  const previous = useRef(location.pathname);
  useEffect(() => {
    const published = routeManifest.find(route => route.path === location.pathname);
    const meta = published ?? notFoundMeta;
    document.title = meta.title;
    for (const selector of ['meta[name="description"]', 'meta[property="og:description"]', 'meta[name="twitter:description"]']) document.querySelector(selector)?.setAttribute('content', meta.description);
    for (const selector of ['meta[property="og:title"]', 'meta[name="twitter:title"]']) document.querySelector(selector)?.setAttribute('content', meta.title);
    const existingCanonical = document.querySelector('link[rel="canonical"]');
    const existingRobots = document.querySelector('meta[name="robots"]');
    if (published) {
      const canonical = existingCanonical ?? document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      canonical.setAttribute('href', siteOrigin + location.pathname);
      if (!existingCanonical) document.head.append(canonical);
      existingRobots?.remove();
    } else {
      existingCanonical?.remove();
      const robots = existingRobots ?? document.createElement('meta');
      robots.setAttribute('name', 'robots');
      robots.setAttribute('content', 'noindex');
      if (!existingRobots) document.head.append(robots);
    }
    document.querySelector('meta[property="og:url"]')?.setAttribute('content', siteOrigin + location.pathname);
    if (location.hash) {
      let anchor = location.hash.slice(1);
      try { anchor = decodeURIComponent(anchor); } catch { /* A malformed fragment has no matching content. */ }
      requestAnimationFrame(() => document.getElementById(anchor)?.scrollIntoView());
    } else if (previous.current !== location.pathname && type !== 'POP') {
      window.scrollTo(0, 0);
      document.getElementById('main-content')?.focus({ preventScroll: true });
    }
    previous.current = location.pathname;
  }, [location, type]);
  return null;
}

export default function App() {
  useEffect(() => registerPortfolioTools(), []);
  const { pathname } = useLocation();
  const published = routeManifest.some(route => route.path === pathname);
  const navItems = [{ path: '/work', label: 'Work' }, { path: '/about', label: 'About' }, { path: '/lab/ask-about-my-work', label: 'Ask' }];
  return <>
    <a href="#main-content" className="skip-link" tabIndex={0}>Skip to content</a>
    <header className="site-header wrap"><Link className="wordmark" to="/" aria-label="nporto.com, home"><img className="brand-logo" src="/brand/nporto-logo.png" width="48" height="53" alt="nporto.com" /></Link><nav aria-label="Main navigation">{navItems.map(item => { const active = published && (pathname === item.path || pathname.startsWith(item.path + '/')); return <Link key={item.path} to={item.path} className={active ? 'active' : undefined} aria-current={active ? 'page' : undefined}>{item.label}</Link>; })}<Link className="nav-contact" to="/#contact">Contact <span aria-hidden="true">↗</span></Link></nav></header>
    <main id="main-content" tabIndex={-1} className="wrap">
      <Suspense fallback={<div className="page-loading" role="status">Loading page…</div>}>
        <NavigationEffects />
        <Routes>{routeManifest.map(route => <Route key={route.path} path={route.path} element={route.kind === 'home' ? <Home /> : route.kind === 'work' ? <Work /> : route.kind === 'case' ? <CaseStudy slug={route.slug} /> : route.kind === 'about' ? <About /> : route.kind === 'ask' ? <Ask /> : <Privacy />} />)}<Route path="/lab" element={<Navigate to="/lab/ask-about-my-work" replace />} /><Route path="/demos" element={<Navigate to="/lab/ask-about-my-work" replace />} /><Route path="*" element={<NotFound />} /></Routes>
      </Suspense>
    </main>
    <footer className="site-footer wrap"><div><Link className="footer-name" to="/" aria-label="nporto.com, home"><img className="brand-logo" src="/brand/nporto-logo.png" width="40" height="44" alt="nporto.com" /></Link><p>Software Engineer</p></div><nav aria-label="Footer navigation"><Link to="/work">Work</Link><Link to="/about">About</Link><Link to="/privacy">Privacy</Link><a href="https://2017.nporto.com/">Previous portfolio <span aria-hidden="true">↗</span></a><a href={contact.github}>GitHub <span aria-hidden="true">↗</span></a></nav></footer>
  </>;
}
