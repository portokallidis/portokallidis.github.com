import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const directory = '.build/diagnostics';
const origin = 'http://127.0.0.1:8787';
await mkdir(directory, { recursive: true });
const browser = await chromium.launch();
const results: object[] = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

try {
  for (const route of ['/', '/work/carre', '/lab/ask-about-my-work']) {
    await page.goto(origin + route);
    await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
    const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
    assert(dimensions.document <= dimensions.viewport, `Desktop CSS zoom overflow: ${route}`);
    assert(await page.locator('h1').isVisible(), `Missing heading after desktop CSS zoom: ${route}`);
    results.push({ route, mode: 'Desktop CSS zoom 200%; not manual browser zoom', width: 1440, height: 900, ...dimensions });
    if (route === '/') await page.screenshot({ path: `${directory}/desktop-css-zoom-200.png` });
  }

  const mobile = await browser.newPage({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  await mobile.goto(origin + '/');
  const before = await mobile.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
  assert(before.document <= before.viewport, 'Mobile baseline has unintended horizontal overflow');
  const session = await mobile.context().newCDPSession(mobile);
  await session.send('Emulation.setPageScaleFactor', { pageScaleFactor: 2 });
  const zoom = await mobile.evaluate(() => ({ scale: visualViewport?.scale, layoutWidth: innerWidth, visualWidth: visualViewport?.width, documentWidth: document.documentElement.scrollWidth }));
  assert.equal(zoom.scale, 2, 'Pinch-zoom emulation did not apply');
  assert.equal(zoom.documentWidth, before.document, 'Pinch zoom unexpectedly changed the document layout');
  await mobile.screenshot({ path: `${directory}/mobile-pinch-zoom-200.png` });
  results.push({ route: '/', mode: 'Chromium mobile pinch-zoom emulation 200%; not a physical device or manual Safari test', width: 375, height: 812, ...zoom });

  const version = JSON.parse(await readFile('node_modules/@playwright/test/package.json', 'utf8')) as { version: string };
  const report = { measuredAt: new Date().toISOString(), origin, playwright: version.version, browser: browser.version(), results };
  await writeFile(`${directory}/reflow.json`, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
