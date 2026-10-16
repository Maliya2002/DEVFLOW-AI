import { expect, test } from '@playwright/test';

test('overview renders honestly without horizontal overflow', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Workspace overview', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Accounts, projects, and team records', { exact: false }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Explore the workspace' }).click();
  await expect(page).toHaveURL(/#workspace-direction$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(errors).toEqual([]);
  await page.goto('/');
  await page.screenshot({ path: testInfo.outputPath('overview.png'), fullPage: true });
});

test('connection checks the real API through the server route', async ({ page, request }) => {
  const response = await request.get('/api/connection');
  expect(response.status()).toBe(200);
  expect(response.headers()['cache-control']).toBe('no-store');
  expect(await response.json()).toEqual({ status: 'available' });
  await page.goto('/connection');
  await expect(page.getByRole('status')).toContainText('Service is available');
  await page.getByRole('button', { name: 'Check again' }).click();
  await expect(page.getByRole('status')).toContainText('Service is available');
  await expect(page.getByText('Last checked at', { exact: false })).toBeVisible();
});

test('workspace map selection updates the capability inspector', async ({ page }) => {
  await page.goto('/');
  const focus = page.getByRole('button', { name: /Focus & balance/ });
  await focus.click();
  await expect(focus).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: /Projects & tasks/ })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  const inspector = page.getByRole('complementary', { name: 'Selected capability' });
  await expect(inspector.getByRole('heading', { name: 'Focus & balance' })).toBeVisible();
  await expect(inspector).toContainText(
    'Time tracked will never be presented as a productivity score.',
  );
  await expect(inspector).toContainText('Not available in this preview');
  await page.getByRole('button', { name: /Work sessions/ }).focus();
  await page.keyboard.press('Enter');
  await expect(inspector.getByRole('heading', { name: 'Work sessions' })).toBeVisible();
});

test('search and category filters combine, reset, and support shortcuts', async ({ page }) => {
  await page.goto('/');
  // A native document shortcut can run only after client hydration attaches it.
  // Confirm a user-visible state change instead of introducing a timed sleep.
  await page.getByRole('button', { name: 'List view', exact: true }).click();
  await expect(page.getByRole('button', { name: 'List view', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Map view', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Map view', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.keyboard.press('/');
  const search = page.getByRole('textbox', { name: 'Search planned capabilities' });
  await expect(search).toBeFocused();
  await search.fill('review');
  await expect(page.getByRole('status')).toHaveText('1 / 6 planned');
  await expect(page.getByRole('button', { name: /D.02 Engineering/ })).toBeVisible();
  await page
    .getByRole('group', { name: 'Filter capabilities' })
    .getByRole('button', { name: 'Context', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'No matching capabilities' })).toBeVisible();
  await page.getByRole('button', { name: 'Reset filters' }).click();
  await expect(page.getByRole('status')).toHaveText('6 / 6 planned');
  await expect(search).toBeFocused();
  await search.fill('time');
  await page.keyboard.press('Escape');
  await expect(search).toHaveValue('');
  await expect(page.getByRole('status')).toHaveText('6 / 6 planned');
});

test('list view and next capability preserve a single selection', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'List view', exact: true }).click();
  await expect(page.getByRole('button', { name: 'List view', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const inspector = page.getByRole('complementary', { name: 'Selected capability' });
  await inspector.getByRole('button', { name: 'Explore next' }).click();
  await expect(inspector.getByRole('heading', { name: 'Engineering', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Engineering/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Map view', exact: true }).click();
  await expect(page.getByRole('button', { name: /Engineering/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('connection recovers from an unavailable response', async ({ page }) => {
  await page.route('**/api/connection', (route) =>
    route.fulfill({ status: 503, json: { status: 'unavailable' } }),
  );
  await page.goto('/connection');
  await expect(page.getByRole('status')).toContainText('Service is unavailable');
  await page.unroute('**/api/connection');
  await page.getByRole('button', { name: 'Check again' }).click();
  await expect(page.getByRole('status')).toContainText('Service is available');
});

test('checking state prevents duplicate refresh requests', async ({ page }) => {
  let release: () => void = () => {};
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/connection', async (route) => {
    await pending;
    await route.fulfill({ json: { status: 'available' } });
  });
  await page.goto('/connection');
  await expect(page.getByRole('status')).toContainText('Checking connection');
  await expect(page.getByRole('button', { name: 'Check again' })).toBeDisabled();
  release();
  await expect(page.getByRole('status')).toContainText('Service is available');
});

test('navigation supports keyboard and mobile disclosure', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  if (testInfo.project.name === 'mobile') {
    const toggle = page.getByRole('button', { name: 'Open navigation' });
    await toggle.click();
    await expect(page.getByRole('navigation')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(toggle).toBeFocused();
    await expect(page.getByRole('navigation')).toBeHidden();
    await toggle.click();
  }
  await page.getByRole('navigation').getByRole('link', { name: 'Connection' }).click();
  await expect(
    page.getByRole('heading', { name: 'Service connection', exact: true }),
  ).toBeVisible();
  if (testInfo.project.name === 'mobile') {
    await expect(page.getByRole('navigation')).toBeHidden();
  } else {
    await expect(
      page.getByRole('navigation').getByRole('link', { name: 'Connection' }),
    ).toHaveAttribute('aria-current', 'page');
  }
});

test('unknown pages show an actual 404 and return link', async ({ page }) => {
  const response = await page.goto('/missing-page');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'That page isn’t here.' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to overview' }).click();
  await expect(
    page.getByRole('heading', { name: 'Workspace overview', exact: true }),
  ).toBeVisible();
});

test('small screens and reduced motion remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe(
    'auto',
  );
  await page.getByRole('link', { name: 'Check service connection' }).click();
  await expect(page.getByRole('status')).toContainText('Service is available');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
