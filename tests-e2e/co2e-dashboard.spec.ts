import { test, expect } from '@playwright/test';
import { collectPageErrors, clientUser, mockApi, seedSession } from './fixtures';

/**
 * The embed CO₂e pages used to add up booking-time estimates. They now show the
 * same figures as the platform: graded-stock impact, buyback, and donations RTG
 * recorded. Embed users are clients and partners, so there is no revenue share
 * and no way to edit donations. The serial view is unchanged.
 */

const totals = {
  jobs: 2,
  withoutCost: 0,
  buyback: '19500.00',
  charity: '1950.00',
  cost: '500.00',
  net: '17050.00',
};

const emptyTotals = {
  jobs: 0,
  withoutCost: 0,
  buyback: '0.00',
  charity: '0.00',
  cost: '0.00',
  net: '0.00',
};

const environmental = {
  clientId: null,
  range: { months: 12, start: '2025-12-01', end: '2026-12-01' },
  factorSet: { id: 'fs-1', version: 3, methodologyLabel: 'RTG workbook', quarantineTreatment: 'reuse' },
  result: {
    co2eKg: '246560',
    waterLitres: '12500',
    mineralsGrams: '8400',
    unitsReused: 8,
    unitsRecycled: 2,
    totalUnits: 10,
    reuseRate: '0.8',
    categories: [
      {
        rtgCategoryName: 'Laptops',
        unitsReused: 8,
        unitsRecycled: 2,
        co2eKg: '246560',
        waterLitres: '12500',
        mineralsGrams: '8400',
        co2Confidence: 'High',
      },
    ],
    lowConfidenceCategories: [],
  },
  display: { co2eTonnes: '246.56', waterM3: '12.5', mineralsKg: '8.4', reuseRatePct: '80' },
  equivalencies: {
    car_miles: { key: 'car_miles', value: 1200, source: 'DESNZ', year: 2024, scopeNote: 'Average UK car' },
    household_water_days: { key: 'household_water_days', value: 40, source: 'Water UK', year: 2024, scopeNote: null },
  },
  excluded: [],
  unmapped: [],
  quarantine: { treatment: 'reuse', units: 0 },
  warnings: { missingCollectionDate: 0 },
  monthly: [
    { key: '2026-11', label: 'Nov 2026', co2eKg: '246560', waterLitres: '12500', mineralsGrams: '8400', totalUnits: 10 },
  ],
  byOrganisation: [
    {
      key: 'northwind',
      name: 'Northwind Ltd',
      bookings: 1,
      co2eKg: '246560',
      waterLitres: '12500',
      mineralsGrams: '8400',
      totalUnits: 10,
    },
  ],
  byPerson: [
    {
      key: 'ada',
      name: 'Ada Lovelace',
      bookings: 1,
      co2eKg: '246560',
      waterLitres: '12500',
      mineralsGrams: '8400',
      totalUnits: 10,
    },
  ],
};

const financial = {
  clientId: null,
  range: { months: 12, start: '2025-12-01', end: '2026-12-01' },
  final: totals,
  estimated: emptyTotals,
  revenueShare: null,
  monthly: [{ key: '2026-11', label: 'Nov 2026', final: '19500.00', estimated: '0.00' }],
  byClient: [],
};

const donations = {
  clientId: null,
  range: { months: 12, start: '2025-12-01', end: '2026-12-01' },
  total: '250.00',
  count: 1,
  byProject: [{ project: 'Community laptops', recipient: 'Reuse Trust', amount: '250.00', count: 1 }],
  monthly: [{ key: '2026-11', label: 'Nov 2026', amount: '250.00' }],
  donations: [
    {
      id: 'don-1',
      clientId: clientUser.tenantId,
      clientName: 'Playwright Client Ltd',
      amount: '250.00',
      recipient: 'Reuse Trust',
      project: 'Community laptops',
      donatedOn: '2026-11-16',
      notes: null,
      createdAt: '2026-11-16T00:00:00.000Z',
      updatedAt: '2026-11-16T00:00:00.000Z',
    },
  ],
};

async function mockImpact(page: import('@playwright/test').Page) {
  const ok = (data: unknown) => JSON.stringify({ success: true, data });
  await page.route('**/api/environmental/overview**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: ok(environmental) })
  );
  await page.route('**/api/financial-impact**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: ok(financial) })
  );
  await page.route('**/api/donations**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: ok(donations) })
  );
}

test.describe('embed CO2e dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
    await mockImpact(page);
    await seedSession(page);
  });

  test('a client sees the new overview, not the old estimate and not the revenue share', async ({ page }) => {
    const errors = collectPageErrors(page);

    await page.goto('/impact');

    await expect(page.getByRole('heading', { name: 'Environmental impact' })).toBeVisible();
    await expect(page.getByText('246.56').first()).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Laptops', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Financial impact' })).toBeVisible();
    await expect(page.getByText('Buyback, final')).toBeVisible();
    await expect(page.getByText('£19,500.00').first()).toBeVisible();
    await expect(page.getByText('RTG pays you').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Social impact' })).toBeVisible();
    await expect(page.getByText('Community laptops').first()).toBeVisible();
    await expect(page.getByText('£250.00').first()).toBeVisible();

    await expect(page.getByRole('combobox').filter({ hasText: 'All clients' })).toHaveCount(0);
    await expect(page.getByText(/Revenue share/i)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Record donation/i })).toHaveCount(0);
    await expect(page.getByText(/trees planted/i)).toHaveCount(0);

    expect(errors, `uncaught page errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('organisation and user views use the graded figures, and serial stays admin-only', async ({ page }) => {
    const errors = collectPageErrors(page);

    await page.goto('/impact?view=organisation');
    await expect(page.getByText('Impact by organisation')).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Northwind Ltd' })).toBeVisible();

    await page.goto('/impact?view=user');
    await expect(page.getByText('Impact by user')).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Ada Lovelace' })).toBeVisible();

    await page.goto('/impact?view=serial');
    await expect(page.getByText('CO₂e by Serial Number')).toBeVisible();
    await expect(page.getByText('Serial-level CO₂ stats are available for admin users.')).toBeVisible();

    expect(errors, `uncaught page errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('a partner can narrow the overview to one client', async ({ page }) => {
    const errors = collectPageErrors(page);
    await mockApi(page, {
      me: {
        user: { ...clientUser, id: '33333333-3333-4333-8333-333333333333', role: 'partner', name: 'Partner User' },
        csrfToken: 'test-csrf',
      },
    });
    await mockImpact(page);

    await page.goto('/impact');

    await expect(page.getByRole('combobox').filter({ hasText: 'All clients' })).toBeVisible();
    await expect(page.getByText(/Revenue share/i)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Record donation/i })).toHaveCount(0);

    expect(errors, `uncaught page errors: ${errors.join(' | ')}`).toEqual([]);
  });
});
