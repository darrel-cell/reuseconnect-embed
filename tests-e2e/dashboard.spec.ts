import { test, expect } from '@playwright/test';
import { collectPageErrors, dashboardStats, mockApi, mockStats, seedSession } from './fixtures';

/**
 * The screen that crashed.
 *
 * `TravelEmissionsBox` read `travelEmissions.petrol` and called `.toFixed()` on
 * it after the API had moved to `travelEmissions.total`. It renders twice on this
 * page, the first one a partner's customer sees, and there was no error boundary
 * to catch it — so the iframe went blank.
 */
test.describe('embed dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
    await seedSession(page);
  });

  test('renders against the real dashboard response shape', async ({ page }) => {
    const errors = collectPageErrors(page);

    await page.goto('/dashboard');

    // Something actually painted — not a blank page.
    await expect(page.locator('main, [data-main-content]').first()).toBeVisible();
    await expect(page.getByText(/Travel Emissions/i).first()).toBeVisible();

    // The recorded total is shown, and no per-fuel split has come back.
    await expect(page.getByText(`${dashboardStats.travelEmissions.total.toFixed(1)}kg`).first())
      .toBeVisible();
    await expect(page.getByText(/^Petrol$|^Diesel$|^Electric$/)).toHaveCount(0);

    expect(errors, `uncaught page errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('survives a dashboard response with travelEmissions missing entirely', async ({ page }) => {
    const errors = collectPageErrors(page);

    // The defensive case: an older or partial response must not blank the page.
    const { travelEmissions, ...withoutTravel } = dashboardStats;
    await mockStats(page, withoutTravel);

    await page.goto('/dashboard');

    await expect(page.locator('main, [data-main-content]').first()).toBeVisible();
    expect(errors, `uncaught page errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('a render error is caught by the boundary instead of blanking the iframe', async ({ page }) => {
    const errors = collectPageErrors(page);

    // Force the exact failure mode: the field the component reads is a string
    // where a number is expected, so any arithmetic on it throws.
    await mockStats(page, {
      ...dashboardStats,
      travelEmissions: { total: 'not-a-number', totalDistanceKm: null, totalDistanceMiles: null },
    });

    await page.goto('/dashboard');

    // Whatever happens, the user must see words — either the dashboard coping
    // with the bad value, or the boundary's "Something went wrong" panel. What
    // must never happen is an empty page.
    const somethingVisible = page
      .getByText(/Something went wrong|Travel Emissions|Dashboard/i)
      .first();
    await expect(somethingVisible).toBeVisible({ timeout: 15_000 });

    await expect(page.locator('body'), 'the page rendered nothing at all').toContainText(/\S/);

    // A caught render error is acceptable here; an unhandled one that leaves the
    // page empty is not, and the assertion above is what distinguishes them.
    if (errors.length) {
      await expect(page.getByText(/Something went wrong/i)).toBeVisible();
    }
  });

  test('navigating to a lazily-loaded route does not leave a blank page', async ({ page }) => {
    const errors = collectPageErrors(page);

    await page.goto('/dashboard');
    // Every route is a separate chunk now; a failed chunk load is the new way to
    // get a blank screen, so walk one.
    await page.goto('/bookings');

    // A retrying assertion, not a one-shot read of innerText: `goto` resolves on
    // `load`, which for a client-rendered app is before React has painted, so a
    // plain read would compare against an empty body every time.
    await expect(page.locator('body')).toContainText(/\S/);
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();

    expect(errors, `uncaught page errors: ${errors.join(' | ')}`).toEqual([]);
  });
});
