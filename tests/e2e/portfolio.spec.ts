import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const askPath = '/lab/ask-about-my-work';
const routes = ['/', '/work', '/work/sylva', '/work/carre', '/work/thrombus-plus', askPath, '/about', '/privacy'];
const optionalResource = /lab-artifacts|\/assets\/[^/]*(?:AskWork|webgpu|native-answer|answer-context|transformers|onnxruntime)|huggingface\.co|hf\.co|\.onnx(?:$|\?)|\.wasm(?:$|\?)/i;
const question = 'What did Nick contribute to CARRE?';

async function withoutLocalAI (page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'LanguageModel', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: undefined });
  });
}

interface NativeHarness {
  creates: number;
  clones: number;
  destroyed: number;
  aborted: number;
  activation: boolean | null;
  prompts: string[];
  progress (value: number): void;
  finishStartup (): void;
  finishAnswer (): void;
}

interface FixtureSession {
  destroy (): void;
  clone (options: { signal: AbortSignal }): Promise<FixtureSession>;
  prompt (input: string, options: { signal: AbortSignal; responseConstraint: { properties: { citations: { items: { enum: string[] } } } } }): Promise<string>;
}

declare global {
  interface Window { __portfolioNative: NativeHarness }
}

async function withNativeAI (page: Page, scenario: 'ready' | 'loading' | 'error-first' | 'slow-answer' | 'invalid-answer' | 'refusal' = 'ready') {
  await page.addInitScript((scenario) => {
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: undefined });
    const harness: NativeHarness = {
      creates: 0, clones: 0, destroyed: 0, aborted: 0, activation: null, prompts: [],
      progress () { }, finishStartup () { }, finishAnswer () { },
    };
    window.__portfolioNative = harness;
    const session = (): FixtureSession => ({
      destroy () { harness.destroyed++; },
      async clone ({ signal }: { signal: AbortSignal }) {
        if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
        harness.clones++;
        return session();
      },
      async prompt (input: string, { signal, responseConstraint }: {
        signal: AbortSignal;
        responseConstraint: { properties: { citations: { items: { enum: string[] } } } };
      }) {
        harness.prompts.push(input);
        signal.addEventListener('abort', () => harness.aborted++, { once: true });
        const supplied = JSON.parse(input.slice(input.lastIndexOf('\n\n') + 2)) as { sources: { id: string; text: string }[] };
        const source = supplied.sources.find(item => responseConstraint.properties.citations.items.enum.includes(item.id));
        if (!source) throw new Error('A native answer must receive retrieved source IDs.');
        const answer = JSON.stringify({ answer: source.text, citations: [source.id], refusal: false });
        if (scenario === 'refusal') return JSON.stringify({ answer: 'The public sources do not provide this information.', citations: [], refusal: true });
        if (scenario === 'invalid-answer') return JSON.stringify({ answer: 'Unsupported test output.', citations: ['invented-source'], refusal: false });
        if (scenario === 'slow-answer') return new Promise<string>(resolve => { harness.finishAnswer = () => resolve(answer); });
        return answer;
      },
    });
    Object.defineProperty(window, 'LanguageModel', {
      configurable: true, value: {
        async availability () { return 'available'; },
        create ({ signal, monitor }: {
          signal: AbortSignal;
          monitor (value: { addEventListener (name: string, callback: (event: { loaded: number }) => void): void }): void;
        }) {
          harness.creates++;
          harness.activation = navigator.userActivation?.isActive ?? null;
          signal.addEventListener('abort', () => harness.aborted++, { once: true });
          monitor({ addEventListener (_name, callback) { harness.progress = value => callback({ loaded: value }); } });
          if (scenario === 'error-first' && harness.creates === 1) return Promise.reject(new Error('Model preparation failed.'));
          if (scenario === 'loading') return new Promise(resolve => { harness.finishStartup = () => resolve(session()); });
          return Promise.resolve(session());
        },
      }
    });
  }, scenario);
}

async function startConversation (page: Page) {
  await page.goto(askPath);
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByRole('log', { name: 'Conversation', exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Your question', exact: true })).toBeVisible();
}

async function sendQuestion (page: Page, text = question) {
  const replies = page.getByRole('log', { name: 'Conversation' }).getByRole('article');
  const previous = await replies.count();
  await page.getByRole('textbox', { name: 'Your question', exact: true }).fill(text);
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(replies).toHaveCount(previous + 1);
  const reply = replies.nth(previous);
  await expect(reply).toHaveAttribute('aria-busy', 'false');
  return reply;
}

test('Start waits for hydration so an early click cannot be lost', async ({ page }) => {
  await withoutLocalAI(page);
  let release!: () => void;
  const hydration = new Promise<void>(resolve => { release = resolve; });
  await page.route(/\/assets\/Ask-[^/]+\.js$/, async route => { await hydration; await route.continue(); });
  try {
    await page.goto(askPath, { waitUntil: 'commit' });
    const start = page.getByRole('button', { name: 'Start', exact: true });
    await expect(start).toBeVisible();
    await expect(start).toBeDisabled();
    release();
    await expect(start).toBeEnabled();
    await start.click();
    await expect(page.getByRole('log', { name: 'Conversation' })).toBeVisible();
  } finally { release(); }
});

test('employer fit questions offer related experience and contact without local AI', async ({ page }) => {
  await withoutLocalAI(page);
  await page.setViewportSize({ width: 375, height: 900 });
  await startConversation(page);
  for (const query of ['Are you suitable for asset management software?', 'Would you be a good fit for fintech?']) {
    const reply = await sendQuestion(page, query);
    await expect(reply).toContainText('Related experience');
    await expect(reply.locator('a[href="/work/sylva#my-contribution"]')).toBeVisible();
    await expect(reply.locator('a[href="/work/carre#what-this-work-demonstrates"]')).toBeVisible();
    await expect(reply.locator('blockquote').first()).toBeVisible();
    await expect(reply.getByRole('link', { name: 'Discuss your project' })).toHaveAttribute('href', '/#contact');
    const contactBox = await reply.getByRole('link', { name: 'Discuss your project' }).boundingBox();
    const transcriptBox = await page.getByRole('log', { name: 'Conversation' }).boundingBox();
    expect(contactBox!.y + contactBox!.height).toBeLessThanOrEqual(transcriptBox!.y + transcriptBox!.height);
  }
  const followUp = await sendQuestion(page, 'Investment portfolios and reporting.');
  await expect(followUp).toContainText('Related experience');
  await expect(followUp).not.toContainText('Which requirements and workflows');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(accessibility.violations).toEqual([]);
  const contact = followUp.getByRole('link', { name: 'Discuss your project' });
  await contact.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/#contact$/);
  await expect(page.locator('#contact')).toBeInViewport();
});

test('a native fit refusal offers original experience without presenting it as a cited answer', async ({ page }) => {
  // This checks presentation of a controlled refusal, not the quality of a real model answer.
  await withNativeAI(page, 'refusal');
  await startConversation(page);
  const reply = await sendQuestion(page, 'Are you suitable for asset management software?');
  await expect(reply).toContainText('Related experience');
  await expect(reply.getByRole('list', { name: 'Related portfolio sources' })).toContainText('SYLVA');
  await expect(reply.getByRole('list', { name: 'Supporting sources' })).toHaveCount(0);
  await expect(reply.getByRole('link', { name: 'Discuss your project' })).toBeVisible();
  await expect(reply).not.toContainText('Insufficient evidence');
});

test('a trailing slash retains published metadata and active navigation after hydration', async ({ page, request }) => {
  // Reproduce hosts that serve the prerendered document at a trailing-slash URL.
  const response = await request.get(askPath);
  await page.route('**' + askPath + '/', route => route.fulfill({ response }));
  await page.goto(askPath + '/');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByRole('log', { name: 'Conversation' })).toBeVisible();
  await expect(page).toHaveTitle('Ask about my work | nporto.com');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://nporto.com' + askPath);
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', 'https://nporto.com' + askPath);
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Ask', exact: true })).toHaveAttribute('aria-current', 'page');
});

test('every route serves unique complete HTML before JavaScript', async ({ browser, request }) => {
  const titles = new Set<string>();
  const favicon = await request.get('/favicon.ico');
  expect(favicon.status()).toBe(200);
  expect(favicon.headers()['content-type']).toMatch(/^image\//);
  expect((await favicon.body()).byteLength).toBeGreaterThan(0);
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    for (const route of routes) {
      expect((await request.get(route)).status(), route).toBe(200);
      await page.goto(`http://127.0.0.1:8787${route}`);
      await expect(page.locator('main')).toBeVisible();
      await expect(page.locator('h1')).toHaveCount(1);
      const content = await page.locator('main').innerText();
      expect(content.length, route).toBeGreaterThan(150);
      expect(content, route).not.toMatch(/\bNikolaos\b|\bN\.\s+Portokallidis\b|portokallidis@gmail\.com/);
      if (route === '/about') expect(content).toContain('Nick Portokallidis');
      const title = await page.title();
      expect(title, route).toContain('nporto.com');
      expect(title, route).not.toContain('Nikolaos');
      for (const landmark of [page.getByRole('banner'), page.getByRole('contentinfo')]) {
        await expect(landmark.getByRole('link', { name: 'nporto.com, home', exact: true })).toBeVisible();
        await expect(landmark.getByRole('img', { name: 'nporto.com', exact: true })).toBeVisible();
        await expect(landmark).not.toContainText('nporto.com');
      }
      expect(await page.getByRole('banner').locator('img').evaluate(element => (element as HTMLImageElement).naturalWidth)).toBe(200);
      await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute('content', 'nporto.com');
      await expect(page.getByRole('contentinfo').getByRole('link', { name: /previous portfolio/i })).toHaveAttribute('href', 'https://2018.nporto.com/');
      expect(titles.has(title), `${route} has a unique title`).toBe(false);
      titles.add(title);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://nporto.com${route}`);
    }
  } finally { await context.close(); }
});

test('host returns real 404s, removes public recordings, and redirects legacy routes directly', async ({ request }) => {
  for (const route of ['/does-not-exist', '/work/unknown-project', '/archive/legacy-site/index.html', '/cv/Portokallidis-CV-2025.docx.pdf',
    '/lab-artifacts/runs/portfolio-a07ddb48448f-78b077d527063018-case-01.json', '/lab-artifacts/manifest.json',
    '/lab-artifacts/evaluation-results.json', '/lab-artifacts/evaluation-summary.json', '/lab-artifacts/evaluation-cases.json', '/lab-artifacts/retrieval-evaluation.json']) {
    expect((await request.get(route)).status(), route).toBe(404);
  }
  const redirects: Record<string, string> = {
    '/projects': '/work', '/demos': askPath, '/demos/': askPath, '/lab': askPath, '/lab/': askPath,
    '/cv': '/about', '/cv/index.html': '/about', '/cv/short_cv.html': '/about', '/academic': '/about', '/techstack': '/about',
    '/work/': '/work', '/work/carre/': '/work/carre',
  };
  for (const [from, to] of Object.entries(redirects)) {
    const response = await request.get(from, { maxRedirects: 0 });
    expect([301, 302, 307, 308], from).toContain(response.status());
    expect(new URL(response.headers().location, 'https://nporto.com').pathname, from).toBe(to);
    expect((await request.get(from)).status(), from).toBe(200);
  }
});

test('navigation hydrates cleanly and restores history', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/');
  const navigation = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(navigation.getByRole('link', { name: 'Ask', exact: true })).toHaveAttribute('href', askPath);
  await navigation.getByRole('link', { name: 'Work', exact: true }).click();
  await expect(page).toHaveURL(/\/work$/);
  await expect(page.locator('main')).toBeFocused();
  await page.locator('main').getByRole('link', { name: /CARRE|healthcare knowledge/i }).first().click();
  await expect(page).toHaveURL(/\/work\/carre$/);
  await expect(page.getByRole('navigation', { name: 'Case study sections' })).toBeVisible();
  // Let the static page's route module hydrate before testing back/forward navigation.
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.locator('h1')).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/work$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/work\/carre$/);
  expect(errors).toEqual([]);
});

test('founders and recruiters can inspect delivery experience and contact without starting AI', async ({ page }) => {
  const optionalRequests: string[] = [];
  page.on('request', request => { if (optionalResource.test(request.url())) optionalRequests.push(request.url()); });
  await page.goto('/');
  const work = page.locator('#selected-work');
  const experiment = page.getByRole('region', { name: 'Personal experiment', exact: true });
  await expect(work).toBeVisible();
  await expect(experiment.getByRole('link', { name: /Ask a question/ })).toHaveAttribute('href', askPath);
  expect(await work.evaluate(element => {
    const experiment = document.querySelector('[aria-label="Personal experiment"]');
    return Boolean(experiment && (element.compareDocumentPosition(experiment) & Node.DOCUMENT_POSITION_FOLLOWING));
  })).toBe(true);
  await page.getByRole('link', { name: /Culcha.*Prototyping through MVP launch/i }).click();
  await expect(page).toHaveURL(/\/work#culcha$/);
  await expect(page.locator('#culcha').getByRole('heading', { name: /^Culcha\b/i })).toBeInViewport();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: /^Contact/ }).click();
  await expect(page).toHaveURL(/\/#contact$/);
  const contact = page.locator('#contact');
  await expect(contact).toContainText('Nick Portokallidis');
  await expect(contact).not.toContainText('portokallidis@gmail.com');
  await expect(contact.getByRole('link', { name: 'Email me', exact: true })).toHaveAttribute('href', 'mailto:portokallidis@gmail.com');
  await expect(contact.getByRole('link', { name: 'Email me', exact: true })).toBeInViewport();
  await expect(contact.getByRole('button', { name: /copy/i })).toHaveCount(0);
  await page.waitForLoadState('networkidle');
  expect(optionalRequests).toEqual([]);
});

test('original logos and unnumbered project rows retain comfortable padding', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [1440, 375, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const headerLogo = await page.getByRole('banner').getByRole('img', { name: 'nporto.com' }).boundingBox();
    const footerLogo = await page.getByRole('contentinfo').getByRole('img', { name: 'nporto.com' }).boundingBox();
    expect(headerLogo?.width).toBe(48);
    expect(headerLogo?.height).toBe(53);
    expect(footerLogo?.width).toBe(40);
    expect(footerLogo?.height).toBe(44);
    await expect(page.locator('.project-number')).toHaveCount(0);
    const project = page.locator('.project-link').first();
    await project.hover();
    const inset = await project.evaluate(element => {
      const styles = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const name = element.querySelector('.project-name')!.getBoundingClientRect();
      return { left: styles.paddingLeft, right: styles.paddingRight, contentOffset: name.left - rect.left, background: styles.backgroundColor };
    });
    const padding = width <= 600 ? 16 : 24;
    expect(inset.left).toBe(`${padding}px`);
    expect(inset.right).toBe(`${padding}px`);
    expect(inset.contentOffset).toBeCloseTo(padding, 1);
    expect(inset.background).not.toBe('rgba(0, 0, 0, 0)');
  }
});

test('About lists the three verified 2026 papers first with DOI links', async ({ page }) => {
  await page.goto('/about');
  const publications = page.locator('#publications li');
  await expect(publications).toHaveCount(9);
  const expected = [
    { title: 'A Dataset for Benchmarking Machine Learning Models for Autonomous Deep Vein Thrombosis Detection Based on Compression Ultrasound Videos', doi: 'https://doi.org/10.5220/0014741500004070', venue: 'Volume 4: HEALTHINF, pp. 853-862' },
    { title: 'A Comprehensive Infrastructure and Methodology for Multi-Modal Data Acquisition to Empower AI-Based Rehabilitation', doi: 'https://doi.org/10.5220/0014351200004070', venue: 'Volume 3: HEALTHINF, pp. 269-278' },
    { title: 'ThrombUS+ Project: Toward Wearable Continuous Point-of-Care Monitoring for Deep Vein Thrombosis of the Lower Limb', doi: 'https://doi.org/10.34133/csbj.0082', venue: '35(2), Article 0082' },
  ];
  for (const [index, publication] of expected.entries()) {
    const item = publications.nth(index);
    await expect(item).toContainText('2026');
    await expect(item).toContainText('Nick Portokallidis');
    await expect(item).toContainText(publication.venue);
    await expect(item.getByRole('link', { name: publication.title, exact: true })).toHaveAttribute('href', publication.doi);
  }
  expect(await publications.locator('.mono').allTextContents()).toEqual(['2026', '2026', '2026', '2016', '2016', '2016', '2016', '2015', '2015']);
});

test('nested 404 hydrates coherently and restores metadata when navigating to work', async ({ page }) => {
  const errors: string[] = [];
  const missingPath = '/work/unknown-project';
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() !== 'error') return;
    const expected404 = message.text().includes('404') && message.location().url.endsWith(missingPath);
    if (!expected404) errors.push(message.text());
  });
  expect((await page.goto(missingPath))?.status()).toBe(404);
  await page.waitForLoadState('networkidle');
  const navigation = page.getByRole('navigation').first();
  await expect(navigation.locator('[aria-current="page"], .active')).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  await navigation.getByRole('link', { name: 'Work', exact: true }).click();
  await expect(page).toHaveURL(/\/work$/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://nporto.com/work');
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  await expect(navigation.getByRole('link', { name: 'Work', exact: true })).toHaveAttribute('aria-current', 'page');
  expect(errors).toEqual([]);
});

test('work filter uses validated URL state', async ({ page }) => {
  await page.goto('/work?domain=Healthcare');
  const domain = page.getByRole('combobox', { name: /domain/i });
  await expect(domain).toHaveValue('Healthcare');
  await expect(page.getByRole('heading', { name: /CARRE|healthcare knowledge/i }).first()).toBeVisible();
  await domain.selectOption('All');
  await expect(page).not.toHaveURL(/domain=Healthcare/);
  await page.goto('/work?domain=unexpected-value');
  await expect(domain).toHaveValue('All');
});

test('keyboard skip and Email me link work without a clipboard control', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: /skip to/i })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
  const email = page.locator('#contact').getByRole('link', { name: 'Email me', exact: true });
  await email.focus();
  await expect(email).toBeFocused();
  await expect(email).toHaveAttribute('href', 'mailto:portokallidis@gmail.com');
  await expect(page.getByRole('button', { name: /copy email/i })).toHaveCount(0);
});

test('Start is the loading boundary and the same chat supports source search and keyboard conversation', async ({ page }) => {
  await withoutLocalAI(page);
  const optionalRequests: string[] = [];
  page.on('request', request => { if (optionalResource.test(request.url())) optionalRequests.push(request.url()); });
  for (const route of ['/', askPath]) {
    await page.goto(route);
    await page.waitForLoadState('networkidle');
    expect(optionalRequests, route).toEqual([]);
  }
  await expect(page.getByRole('button', { name: 'Start', exact: true })).toHaveCount(1);
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  const conversation = page.getByRole('log', { name: 'Conversation' });
  const input = page.getByRole('textbox', { name: 'Your question' });
  await expect(conversation).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Portfolio source search');
  await expect(page.getByRole('button', { name: /Recorded examples|Search my work|Ask locally|Enable/i })).toHaveCount(0);
  await input.fill('CARRE');
  await input.press('Shift+Enter');
  await input.pressSequentially('ontology');
  await expect(input).toHaveValue('CARRE\nontology');
  await expect(conversation.getByRole('article')).toHaveCount(0);
  await input.press('Enter');
  const reply = conversation.getByRole('article');
  await expect(reply).toContainText('Source search');
  await expect(reply.getByRole('list', { name: 'Supporting sources' })).toContainText('CARRE');
  await expect(reply.locator('blockquote').first()).toBeVisible();
  await expect(input).toHaveValue('');
  await sendQuestion(page, 'Which technologies did it use?');
  await expect(conversation.getByRole('article')).toHaveCount(2);
  await expect(conversation.getByRole('article').last()).toContainText('CARRE');
  expect(optionalRequests.some(url => url.endsWith('/lab-artifacts/corpus.json'))).toBe(true);
  expect(optionalRequests.filter(url => /webgpu|native-answer|huggingface|\.onnx|\.wasm/i.test(url))).toEqual([]);
  expect(new URL(page.url()).search).toBe('');
  expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }))).toEqual({ local: 0, session: 0 });
  await page.getByRole('button', { name: 'Clear conversation', exact: true }).click();
  await expect(conversation.getByRole('article')).toHaveCount(0);
  await expect(input).toBeFocused();
  await expect(page.getByRole('button', { name: 'Clear conversation' })).toHaveCount(0);
});

test('corrupted sources can be retried without breaking navigation', async ({ page }) => {
  await withoutLocalAI(page);
  let firstRequest = true;
  await page.route('**/lab-artifacts/corpus.json', async route => {
    if (firstRequest) { firstRequest = false; await route.fulfill({ contentType: 'application/json', body: '{"schemaVersion":999}' }); }
    else await route.continue();
  });
  await page.goto(askPath);
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('navigation').first().getByRole('link', { name: 'Work', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Retry loading sources' }).click();
  await expect(page.getByRole('log', { name: 'Conversation' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(await sendQuestion(page)).toContainText('CARRE');
});

test('empty questions and unsupported queries receive usable feedback', async ({ page }) => {
  await withoutLocalAI(page);
  await startConversation(page);
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Enter a question');
  await expect(page.getByRole('textbox', { name: 'Your question' })).toHaveAttribute('aria-invalid', 'true');
  const reply = await sendQuestion(page, 'qzxvnonexistentterm');
  await expect(reply).toContainText('Not covered in this portfolio');
  await expect(reply.getByRole('list', { name: 'Supporting sources' })).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('native creation starts with the click and replies cite actual portfolio anchors', async ({ page, request }) => {
  await withNativeAI(page);
  await page.goto(askPath);
  expect(await page.evaluate(() => window.__portfolioNative.creates)).toBe(0);
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByRole('log', { name: 'Conversation' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('On-device chat');
  const startup = await page.evaluate(() => ({ creates: window.__portfolioNative.creates, activation: window.__portfolioNative.activation }));
  expect(startup.creates).toBe(1);
  if (startup.activation !== null) expect(startup.activation).toBe(true);
  const first = await sendQuestion(page);
  await expect(first).toContainText('Answered locally');
  const source = first.getByRole('list', { name: 'Supporting sources' }).getByRole('link').first();
  const href = await source.getAttribute('href');
  expect(href).toMatch(/^\/work\/carre(?:#|$)/);
  expect((await request.get(href!)).status()).toBe(200);
  await sendQuestion(page, 'Which technologies did it use?');
  expect(await page.evaluate(() => window.__portfolioNative.prompts[1])).toContain(question);
  expect(await page.evaluate(() => window.__portfolioNative.clones)).toBe(2);
  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(accessibility.violations).toEqual([]);
  expect(await page.evaluate(() => window.__portfolioNative.destroyed)).toBeGreaterThanOrEqual(2);
  await source.click();
  await expect(page).toHaveURL(/\/work\/carre(?:#|$)/);
  if (href!.includes('#')) await expect(page.locator(`#${href!.split('#')[1]}`)).toBeInViewport();
});

test('native download progress can be cancelled and a late session cannot reopen the chat', async ({ page }) => {
  await withNativeAI(page, 'loading');
  await page.goto(askPath);
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Preparing the chat' })).toBeVisible();
  await page.evaluate(() => window.__portfolioNative.progress(0.25));
  await expect(page.getByRole('progressbar', { name: 'Chat loading progress' })).toHaveAttribute('value', '0.25');
  await expect(page.getByText('25%', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeVisible();
  await page.evaluate(() => window.__portfolioNative.finishStartup());
  await expect.poll(() => page.evaluate(() => window.__portfolioNative.destroyed)).toBe(1);
  expect(await page.evaluate(() => window.__portfolioNative.aborted)).toBeGreaterThan(0);
  await expect(page.getByRole('log', { name: 'Conversation' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.evaluate(() => window.__portfolioNative.progress(1));
  await page.evaluate(() => window.__portfolioNative.finishStartup());
  await expect(page.getByRole('log', { name: 'Conversation' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('On-device chat');
});

test('a failed native startup keeps source search usable and Retry AI recovers', async ({ page }) => {
  await withNativeAI(page, 'error-first');
  await startConversation(page);
  await expect(page.getByText(/Local AI couldn’t start/)).toBeVisible();
  await expect(await sendQuestion(page)).toContainText('Source search');
  await page.getByRole('button', { name: 'Retry AI', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('On-device chat');
  await expect(await sendQuestion(page, 'What was the Culcha contribution?')).toContainText('Answered locally');
  expect(await page.evaluate(() => window.__portfolioNative.creates)).toBe(2);
});

test('Stop and Clear conversation abort generation without showing late answers', async ({ page }) => {
  await withNativeAI(page, 'slow-answer');
  await startConversation(page);
  const input = page.getByRole('textbox', { name: 'Your question' });
  const conversation = page.getByRole('log', { name: 'Conversation' });
  await input.fill(question);
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__portfolioNative.prompts.length)).toBe(1);
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await page.evaluate(() => window.__portfolioNative.finishAnswer());
  await expect(conversation.getByRole('article')).toContainText('Answer stopped.');
  await expect(conversation.getByRole('list', { name: 'Supporting sources' })).toHaveCount(0);
  await expect(input).toBeFocused();
  await input.fill('Which technologies are documented for SYLVA?');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__portfolioNative.prompts.length)).toBe(2);
  await page.getByRole('button', { name: 'Clear conversation', exact: true }).click();
  await page.evaluate(() => window.__portfolioNative.finishAnswer());
  await expect(conversation.getByRole('article')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeVisible();
  await expect(input).toBeFocused();
  expect(await page.evaluate(() => window.__portfolioNative.aborted)).toBeGreaterThanOrEqual(2);
});

test('invalid native citations fall back to original passages in the same conversation', async ({ page }) => {
  await withNativeAI(page, 'invalid-answer');
  await startConversation(page);
  const reply = await sendQuestion(page);
  await expect(reply).toContainText('Source search');
  await expect(reply).toContainText('I couldn’t generate a reliable answer');
  await expect(reply).not.toContainText('Unsupported test output.');
  await expect(reply.getByRole('list', { name: 'Supporting sources' })).toContainText('CARRE');
  await expect(page.getByRole('button', { name: 'Retry AI', exact: true })).toBeVisible();
});

test('production static headers protect documents', async ({ request }) => {
  const headers = (await request.get('/work/carre')).headers();
  expect(headers['content-security-policy']).toContain("default-src 'self'");
  expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['referrer-policy']).toBeTruthy();
});

test('published pages pass the automated WCAG AA accessibility audit', async ({ page }) => {
  for (const route of routes) {
    await page.goto(route);
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(result.violations, route).toEqual([]);
  }
});

test('source-search conversation and validation feedback remain accessible', async ({ page }) => {
  await withoutLocalAI(page);
  await startConversation(page);
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  let result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(result.violations).toEqual([]);
  await sendQuestion(page, 'CARRE ontology');
  result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(result.violations).toEqual([]);
});

for (const width of [320, 375, 768, 1024, 1440]) {
  test(`portfolio and loaded conversation stay usable at ${width}px`, async ({ page }) => {
    await withoutLocalAI(page);
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const route of ['/', '/work', '/work/carre', '/about', askPath]) {
      await page.goto(route);
      await expect(page.locator('h1')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth), route).toBeLessThanOrEqual(width);
    }
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    const input = page.getByRole('textbox', { name: 'Your question' });
    await expect(input).toBeVisible();
    const reply = await sendQuestion(page, 'CARRE ontology');
    await expect(reply.getByRole('list', { name: 'Supporting sources' })).toBeVisible();
    await input.scrollIntoViewIfNeeded();
    await expect(input).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeInViewport();
    const composer = await input.boundingBox();
    expect(composer!.x).toBeGreaterThanOrEqual(0);
    expect(composer!.x + composer!.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.getByRole('button', { name: 'Clear conversation', exact: true }).click();
    await expect(page.getByRole('log', { name: 'Conversation' }).getByRole('article')).toHaveCount(0);
  });
}
