import { test, expect, type Page } from '@playwright/test';
import { collectPageErrors, mockApi, seedSession } from './fixtures';

/**
 * Booking authoring and the JML sub-types, inside the embed.
 *
 * These pages are copies of the portal's, so they carry the same defects — and the
 * embed is where that costs the most: it renders inside a partner's iframe with no
 * error boundary the partner can see, and a blank frame is what shipped last time.
 * The postcode/country check in particular was wrong in two ways at once: the effect
 * did not re-run when the country changed, and `validateEuropeanPostcode` ignored
 * the country argument outright, looking its pattern table up by country name when
 * it is keyed by ISO code. Both are asserted here.
 *
 * Every spec fails on an uncaught `pageerror`: a React render error unmounts the
 * tree, so a test that only checks for the absence of a string can pass against an
 * empty frame.
 */

/** Nominatim, as the geocoder would answer for a postcode it recognises. */
const NOMINATIM_HIT = [
  {
    lat: '48.8606',
    lon: '2.3376',
    display_name: '1 Rue de Rivoli, Paris, 75001, France',
    address: { road: 'Rue de Rivoli', city: 'Paris', postcode: '75001', country: 'France' },
  },
];

/**
 * Intercept the geocoder and report what it was asked for.
 *
 * The page calls OpenStreetMap directly, so without this the suite would depend on a
 * third-party service. Counting the calls is also the assertion: the request only
 * fires once validation passes.
 */
async function mockGeocoder(page: Page) {
  const queries: string[] = [];
  await page.route('https://nominatim.openstreetmap.org/**', (route) => {
    queries.push(new URL(route.request().url()).searchParams.get('q') ?? '');
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(NOMINATIM_HIT),
    });
  });
  return queries;
}

/**
 * A postcode valid for one country and invalid for another must be judged by the
 * country beside it. 75001 is a French postcode; against the UK pattern it fails.
 */
async function expectCountryAwareValidation(page: Page, prefix = '') {
  const queries = await mockGeocoder(page);
  await page.fill(`#${prefix}country`, 'United Kingdom');
  await page.fill(`#${prefix}postcode`, '75001');
  await page.waitForTimeout(1600); // the effect debounces for 1000ms
  expect(queries, 'geocoded a postcode that is invalid for the selected country').toEqual([]);

  await page.fill(`#${prefix}country`, 'France');
  await expect
    .poll(() => queries.length, {
      message: 'changing the country did not re-validate the postcode',
      timeout: 8_000,
    })
    .toBeGreaterThan(0);
  return queries;
}

const AUTHORING_ROUTES = [
  { name: 'booking type chooser', path: '/booking', expect: /Select ITAD Collection/i },
  { name: 'ITAD collection', path: '/booking/itad', expect: /Collection Site Details/i },
  { name: 'free courier collection', path: '/booking/courier', expect: /Free courier collection/i },
  { name: 'JML new starter', path: '/bookings/jml/new-starter', expect: /Employee Details/i },
  { name: 'JML leaver', path: '/bookings/jml/leaver', expect: /Leaver Details/i },
  { name: 'JML breakfix', path: '/bookings/jml/breakfix', expect: /Employee Details/i },
  { name: 'JML mover', path: '/bookings/jml/mover', expect: /Current Address \(Collection\)/i },
] as const;

test.describe('embed authoring pages', () => {
  for (const route of AUTHORING_ROUTES) {
    test(`${route.name} renders inside the embed`, async ({ page }) => {
      const errors = collectPageErrors(page);
      await mockGeocoder(page);
      await mockApi(page);
      await seedSession(page);

      await page.goto(route.path);

      await expect(page.getByText(route.expect).first()).toBeVisible();
      await expect(page.locator('body')).toContainText(/\S/);
      expect(errors, `uncaught page errors: ${errors.join(' | ')}`).toEqual([]);
    });
  }

  test('the ITAD form judges a postcode against the country beside it', async ({ page }) => {
    const errors = collectPageErrors(page);
    await mockApi(page);
    await seedSession(page);

    await page.goto('/booking/itad');
    await expect(page.getByText(/Collection Site Details/i)).toBeVisible();

    const queries = await expectCountryAwareValidation(page);
    expect(queries[0]).toContain('75001');

    expect(errors, `uncaught page errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('each JML sub-type judges its postcode against its country', async ({ page }) => {
    const errors = collectPageErrors(page);
    await mockApi(page);
    await seedSession(page);

    for (const path of [
      '/bookings/jml/new-starter',
      '/bookings/jml/leaver',
      '/bookings/jml/breakfix',
    ]) {
      await page.goto(path);
      await expect(page.locator('#postcode')).toBeVisible();
      await expectCountryAwareValidation(page);
    }

    expect(errors, `uncaught page errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('the mover judges its two addresses independently', async ({ page }) => {
    const errors = collectPageErrors(page);
    await mockApi(page);
    await seedSession(page);

    await page.goto('/bookings/jml/mover');
    await expect(page.getByText(/Current Address \(Collection\)/i)).toBeVisible();
    await expect(page.getByText(/New Address \(Delivery\)/i)).toBeVisible();

    // Collect from the old desk, deliver to the new one — two addresses, two effects,
    // and the same bug in each.
    await expectCountryAwareValidation(page, 'current-');
    await expectCountryAwareValidation(page, 'new-');

    expect(errors, `uncaught page errors: ${errors.join(' | ')}`).toEqual([]);
  });
});
