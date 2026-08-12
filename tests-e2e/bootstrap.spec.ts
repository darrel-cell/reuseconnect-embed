import { test, expect } from '@playwright/test';
import {
  PARTNER_SLUG,
  collectPageErrors,
  mockApi,
  partner,
  seedSession,
} from './fixtures';

/**
 * The bootstrap has three outcomes and they must be told apart, because the
 * remedies differ: an unavailable account needs an administrator, a stale link
 * just needs reopening from the partner's portal.
 */
test.describe('embed bootstrap', () => {
  test('a refused account shows the branded unavailable screen, not an error', async ({ page }) => {
    const errors = collectPageErrors(page);
    await mockApi(page);

    // The API refuses at exchange, carrying the stable code the app branches on.
    await page.route('**/api/embed/exchange', (route) =>
      route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'This account cannot be opened from here at the moment. Please contact your administrator.',
          code: 'EMBED_ACCOUNT_UNAVAILABLE',
        }),
      })
    );

    await page.goto(`/p/${PARTNER_SLUG}?token=refused-token`);

    await expect(page.getByRole('heading', { name: 'This account is not available' })).toBeVisible();
    await expect(page.getByText(/contact your administrator/i)).toBeVisible();

    // The partner's name appears; the reason for the refusal never does.
    await expect(page.getByText(partner.displayName, { exact: false }).first()).toBeVisible();
    await expect(page.getByText(/deleted|disabled|inactive|declined|belongs to/i)).toHaveCount(0);

    // No retry button: retrying cannot change an administrative decision.
    await expect(page.getByRole('button', { name: /try again|retry/i })).toHaveCount(0);

    expect(errors, `uncaught page errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('a stale link shows the reopen-from-partner screen', async ({ page }) => {
    const errors = collectPageErrors(page);
    await mockApi(page);

    await page.route('**/api/embed/exchange', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'Embed token has already been used' }),
      })
    );

    await page.goto(`/p/${PARTNER_SLUG}?token=used-token`);

    await expect(page.getByRole('heading', { name: 'This portal link cannot be opened' })).toBeVisible();
    await expect(page.getByText(/Portal links can only be used once/i)).toBeVisible();

    // It must NOT be mistaken for the account-unavailable case.
    await expect(page.getByRole('heading', { name: 'This account is not available' })).toHaveCount(0);

    expect(errors, `uncaught page errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('opening the portal with no token asks the user to start from the partner site', async ({ page }) => {
    const errors = collectPageErrors(page);
    await mockApi(page, { me: { user: null } });

    await page.goto(`/p/${PARTNER_SLUG}`);

    await expect(page.getByText(/Open this page from your partner portal/i)).toBeVisible();
    expect(errors, `uncaught page errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('a successful exchange lands on the dashboard', async ({ page }) => {
    const errors = collectPageErrors(page);
    await mockApi(page);

    await page.route('**/api/embed/exchange', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            token: 'test-embed-jwt',
            csrfToken: 'test-csrf',
            user: {
              id: '11111111-1111-4111-8111-111111111111',
              email: 'browser.test@e2e.local',
              name: 'Browser Test',
              role: 'client',
              status: 'active',
              tenantId: '22222222-2222-4222-8222-222222222222',
              createdAt: '2026-01-01T00:00:00.000Z',
            },
            partner,
          },
        }),
      })
    );

    await page.goto(`/p/${PARTNER_SLUG}?token=good-token`);

    await expect(page).toHaveURL(/\/dashboard$/);
    // The token must not survive in the URL, or it could be replayed from history.
    expect(page.url()).not.toContain('token=');

    expect(errors, `uncaught page errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('an expired session is reported, not left showing stale UI', async ({ page }) => {
    const errors = collectPageErrors(page);
    await mockApi(page);
    await seedSession(page);

    // The session is gone by the time the app asks who it is.
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { user: null } }),
      })
    );

    await page.goto('/dashboard');

    await expect(page.getByText(/Open this portal from your partner website/i)).toBeVisible();
    expect(errors, `uncaught page errors: ${errors.join(' | ')}`).toEqual([]);
  });
});
