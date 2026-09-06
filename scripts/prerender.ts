import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { notFoundMeta, routeManifest } from '../src/route-manifest';

const origin = process.env.SITE_ORIGIN ?? 'https://nporto.com';
const url = new URL(origin);
if (url.protocol !== 'https:' || url.origin !== origin || /localhost|example\.|placeholder/.test(url.hostname)) throw new Error('SITE_ORIGIN must be a production HTTPS origin without a trailing slash.');
const trialToken = process.env.WEBMCP_ORIGIN_TRIAL_TOKEN?.trim();
if (trialToken && (trialToken.length > 8192 || !/^[A-Za-z0-9+/=_-]+$/.test(trialToken))) throw new Error('WEBMCP_ORIGIN_TRIAL_TOKEN must contain one encoded origin trial token.');
const { render } = await import(pathToFileURL(resolve('.build/server/entry-server.js')).href) as { render: (path: string) => Promise<string> };
const template = await readFile('dist/index.html', 'utf8');
const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
for (const route of [...routeManifest, { path: '/404', ...notFoundMeta }]) {
  const body = await render(route.path);
  const canonical = origin + (route.path === '/404' ? '/' : route.path);
  const metadata = `<meta name="description" content="${escape(route.description)}"><meta property="og:title" content="${escape(route.title)}"><meta property="og:description" content="${escape(route.description)}"><meta property="og:type" content="website"><meta property="og:url" content="${canonical}"><meta property="og:site_name" content="nporto.com"><meta name="twitter:card" content="summary"><meta name="twitter:title" content="${escape(route.title)}"><meta name="twitter:description" content="${escape(route.description)}">${route.path === '/404' ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${canonical}">`}`;
  // Chrome validates the token's origin, feature, and expiry; an absent token changes nothing.
  const trialMeta = trialToken ? `<meta http-equiv="origin-trial" content="${escape(trialToken)}">` : '';
  const html = template.replace(/<title>.*?<\/title>/, `<title>${escape(route.title)}</title>`).replace('</head>', `${metadata}${trialMeta}</head>`).replace('<div id="root"></div>', `<div id="root">${body}</div>`);
  const path = route.path === '/' ? 'dist/index.html' : route.path === '/404' ? 'dist/404.html' : `dist${route.path}/index.html`;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, html);
}
await writeFile('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routeManifest.map(route => `<url><loc>${origin}${route.path}</loc></url>`).join('')}</urlset>\n`);
await writeFile('dist/robots.txt', `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);
console.log(`Prerendered ${routeManifest.length} public routes and 404.html.`);
