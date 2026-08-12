import type { Page } from '@playwright/test';

/**
 * Mocked API responses.
 *
 * Every shape here mirrors what the ReuseConnect API actually returns. That is
 * the whole point: the crash these tests guard against happened because the app
 * read `travelEmissions.petrol` after the API had moved to `travelEmissions.total`
 * — so `dashboardStats` below carries the current shape, and if the API changes
 * again the fixture has to change with it.
 *
 * The server side of the same contract is asserted in the backend suite
 * (`e2e/embed-access.ts` checks `/dashboard/stats` for exactly these fields), so
 * a divergence fails there rather than passing silently here.
 */

export const PARTNER_SLUG = 'e2e-playwright-partner';

export const partner = {
  slug: PARTNER_SLUG,
  displayName: 'Playwright Partner Ltd',
  logoUrl: null,
  websiteUrl: 'https://partner.example.com',
};

export const clientUser = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'browser.test@e2e.local',
  name: 'Browser Test',
  role: 'client',
  status: 'active',
  tenantId: '22222222-2222-4222-8222-222222222222',
  tenantName: 'Playwright Client Ltd',
  isSuperAdmin: false,
  createdAt: '2026-01-01T00:00:00.000Z',
};

/** The current `/dashboard/stats` shape — no per-fuel split. */
export const dashboardStats = {
  totalJobs: 3,
  activeJobs: 1,
  totalCO2eSaved: 812.5,
  totalBuyback: 240,
  totalAssets: 7,
  avgCharityPercent: 10,
  travelEmissions: {
    total: 18.4,
    totalDistanceKm: 54.1,
    totalDistanceMiles: 33.6,
  },
  completedJobsCount: 2,
  bookedJobsCount: 1,
  completedCO2eSaved: 610.2,
  estimatedCO2eSaved: 202.3,
  jmlImpact: {
    mover: { jobs: 0, saved: 0, travel: 0 },
    breakfix: { jobs: 0, saved: 0, travel: 0, deliveryTravel: 0, collectionTravel: 0 },
    newStarter: { jobs: 0, saved: 0, travel: 0 },
    leaver: { jobs: 0, saved: 0, travel: 0 },
  },
};

const ok = (data: unknown, pagination?: unknown) =>
  JSON.stringify({ success: true, data, ...(pagination ? { pagination } : {}) });

const emptyPage = { page: 1, limit: 20, total: 0, totalPages: 0 };

/**
 * Serve the API from fixtures.
 *
 * Registration order matters: Playwright checks handlers newest-first, so the
 * catch-all goes in FIRST and the specific endpoints after it. Registering the
 * catch-all last silently shadows every specific mock — which looks exactly like
 * the app being broken.
 */
export async function mockApi(
  page: Page,
  overrides: { stats?: unknown; me?: unknown } = {}
) {
  // Fallback for anything not mocked below: a well-formed empty response, so an
  // unrelated 404 is never what fails a rendering test.
  await page.route('**/api/**', (route) => {
    const url = route.request().url();
    // Anything list-shaped must answer with an array. A component that does
    // `data.map(...)` on `{}` throws, and the resulting "Something went wrong" reads
    // as a product bug when it is really a missing fixture.
    const isList =
      /\/(bookings|jobs|documents|sites|inventory|notifications|clients|asset-categories|sanitisation|grading)(\?|$)/.test(
        url
      );
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: isList ? ok([], emptyPage) : ok({}),
    });
  });

  // The booking and JML forms cannot render their asset grid without these.
  await page.route('**/api/asset-categories**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: ok([
        { id: 'cat-laptop', name: 'Laptop', co2ePerUnit: 200, avgWeight: 2.2, buybackFloor: 60 },
        { id: 'cat-monitor', name: 'Monitor', co2ePerUnit: 120, avgWeight: 5, buybackFloor: 15 },
      ]),
    })
  );

  // `ProtectedRoute` sends a client to /settings until their profile is complete, so
  // without this every authoring route silently redirects and the test reads as a
  // rendering failure when it is correct behaviour.
  await page.route('**/api/clients/profile/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: ok({
        id: '55555555-5555-4555-8555-555555555555',
        name: clientUser.name,
        email: clientUser.email,
        phone: '02071110000',
        organisationName: 'Playwright Client Ltd',
        registrationNumber: '10203040',
        address: '10 Acme Road, London',
        hasProfile: true,
      }),
    })
  );

  await page.route('**/api/embed/partners/*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: ok(partner) })
  );

  await page.route('**/api/auth/csrf-token', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: ok({ csrfToken: 'test-csrf' }) })
  );

  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: ok(overrides.me ?? { user: clientUser, csrfToken: 'test-csrf' }),
    })
  );

  await mockStats(page, overrides.stats ?? dashboardStats);
}

/**
 * Replace the dashboard-stats response.
 *
 * Registered later than `mockApi`'s copy, so it wins — which is how a test asks
 * for a different payload without re-mocking everything.
 */
export async function mockStats(page: Page, stats: unknown) {
  await page.route('**/api/dashboard/stats', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: ok(stats) })
  );
}

/** Put a signed-in embed session in place, as a successful exchange would. */
export async function seedSession(page: Page) {
  await page.addInitScript(
    ({ token, partnerInfo }) => {
      sessionStorage.setItem('embed_auth_token', token);
      sessionStorage.setItem('embed_partner', JSON.stringify(partnerInfo));
    },
    { token: 'test-embed-jwt', partnerInfo: partner }
  );
}

/**
 * Collect uncaught page errors.
 *
 * This is the assertion that matters. A React render error unmounts the tree and
 * leaves a blank page; without watching for it, a test can "pass" against
 * nothing at all.
 */
export function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}
