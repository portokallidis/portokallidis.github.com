import { expect, test } from '@playwright/test';

test('short follow-ups retain the project until an explicit topic change or Clear', async ({ page }) => {
  // Test real public retrieval and the composer without downloading or mocking model answers.
  await page.addInitScript(() => {
    Object.defineProperty(window, 'LanguageModel', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: undefined });
  });
  await page.goto('/lab/ask-about-my-work');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  const input = page.getByRole('textbox', { name: 'Your question', exact: true });
  await expect(input).toBeVisible();
  const replies = page.getByRole('log', { name: 'Conversation' }).getByRole('article');
  const send = async (question: string) => {
    const count = await replies.count();
    await input.fill(question);
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(replies).toHaveCount(count + 1);
    const reply = replies.nth(count);
    await expect(reply).toHaveAttribute('aria-busy', 'false');
    await expect(page.locator('.chat-question').nth(count)).toHaveText('You: ' + question);
    return reply;
  };

  await send('What did Nick contribute to CARRE?');
  const dates = await send('When?');
  await expect(dates.getByRole('list', { name: 'Supporting sources' })).toContainText('CARRE');
  await expect(dates).toContainText('2014 to 2016');
  const role = await send('What was his role?');
  await expect(role.getByRole('list', { name: 'Supporting sources' })).toContainText('CARRE');
  const technologies = await send('Which technologies did he use?');
  await expect(technologies.getByRole('list', { name: 'Supporting sources' })).toContainText('CARRE');

  const changed = await send('What was his role at SYLVA?');
  await expect(changed.getByRole('list', { name: 'Supporting sources' })).toContainText('SYLVA');
  await expect(changed.locator('a[href^="/work/carre"]')).toHaveCount(0);
  const changedDates = await send('When?');
  await expect(changedDates.getByRole('list', { name: 'Supporting sources' })).toContainText('SYLVA');
  await expect(changedDates).toContainText('2017 to 2024');

  const identity = await send('Who is Nick Portokallidis?');
  await expect(identity.locator('a[href="/about#approach"]')).toBeVisible();
  await expect(identity.locator('a[href^="/work/"]')).toHaveCount(0);

  await page.getByRole('button', { name: 'Clear conversation' }).click();
  const cleared = await send('When?');
  await expect(cleared).toContainText('Not covered in this portfolio');
  await expect(cleared.getByRole('list', { name: 'Supporting sources' })).toHaveCount(0);
});
