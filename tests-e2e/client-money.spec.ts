import { test, expect, type Page } from '@playwright/test';
import { clientUser, collectPageErrors, mockApi, seedSession } from './fixtures';

/**
 * The money a partner's customer sees: which way it goes on the job page, and the
 * graded value on the grading report.
 *
 * RTG asked for "RTG pays you £X" / "You pay RTG £X" in place of "Total Client
 * Responsibility", which read as money the client owes either way. The grading
 * figure is the graded buyback, not RTG's sale price (only the partner and RTG see
 * that), so it is called the graded value, never the resale value.
 *
 * Shapes recorded from the API (GET /jobs/:id, /bookings/:id, /grading).
 */

const JOB_ID = '33333333-3333-4333-8333-333333333333';
const BOOKING_ID = '44444444-4444-4444-8444-444444444444';
const MONITOR = '55555555-5555-4555-8555-555555555555';
const DESKTOP = '66666666-6666-4666-8666-666666666666';

const job = (buybackValue: number, costOfServiceTotal: number) => ({
  id: JOB_ID,
  erpJobNumber: 'ERP-2026-00001',
  bookingId: BOOKING_ID,
  organisationName: clientUser.tenantName,
  clientName: clientUser.tenantName,
  siteName: 'Head Office',
  siteAddress: '1 Test Street, Bristol',
  status: 'completed',
  scheduledDate: '2026-10-02T09:00:00.000Z',
  completedDate: '2026-10-09T09:00:00.000Z',
  assets: [
    {
      id: '77777777-7777-4777-8777-777777777777', category: 'Monitor/VDU', categoryId: MONITOR, categoryName: 'Monitor/VDU',
      quantity: 20, serialNumbers: [], grade: null, weight: null, sanitised: true, wipeMethod: null,
      sanitisationRecordId: null, gradingRecordId: null, resaleValue: null,
    },
  ],
  driver: null,
  co2eSaved: 4800,
  travelEmissions: 110.23,
  buybackValue,
  buybackFinalised: true,
  costOfServiceBase: costOfServiceTotal,
  costOfServiceAdjustment: 0,
  costOfServiceTotal,
  charityPercent: 0,
  roundTripDistanceKm: 50,
  roundTripDistanceMiles: 31.07,
  bookingType: 'itad_collection',
  jmlSubType: null,
  postcode: 'BS1 6DZ',
  siteContactName: 'Site Contact',
  siteContactPhone: '0117 496 0000',
  evidence: [],
  certificates: [],
});

const booking = {
  id: BOOKING_ID,
  bookingNumber: 'BK-2026-00001',
  erpJobNumber: 'ERP-2026-00001',
  status: 'graded',
  estimatedCO2e: 6000,
  estimatedBuyback: 120,
  charityPercent: 0,
  createdAt: '2026-08-30T16:52:49.000Z',
  clientId: '88888888-8888-4888-8888-888888888888',
  clientName: clientUser.tenantName,
  organisationName: clientUser.tenantName,
  siteName: 'Head Office',
  siteAddress: '1 Test Street, Bristol',
  postcode: 'BS1 6DZ',
  scheduledDate: '2026-09-05T09:00:00.000Z',
  jobId: JOB_ID,
  jobStatus: 'graded',
  createdBy: clientUser.id,
  bookingType: 'itad_collection',
  statusHistory: [],
  assets: [
    { id: '99999999-9999-4999-8999-999999999991', categoryId: DESKTOP, category: 'Desktop', categoryName: 'Desktop', quantity: 12 },
    { id: '99999999-9999-4999-8999-999999999992', categoryId: MONITOR, category: 'Monitor/VDU', categoryName: 'Monitor/VDU', quantity: 12 },
  ],
};

const grading = [
  { grade: 'A', quantity: 3, resaleValue: 11, assetId: DESKTOP, assetCategory: 'Desktop' },
  { grade: 'B', quantity: 6, resaleValue: 10, assetId: DESKTOP, assetCategory: 'Desktop' },
  { grade: 'B', quantity: 12, resaleValue: 0, assetId: MONITOR, assetCategory: 'Monitor/VDU' },
].map((r, i) => ({
  id: `aaaaaaaa-aaaa-4aaa-8aaa-00000000000${i}`,
  bookingId: BOOKING_ID,
  gradedAt: '2026-09-08T16:27:35.000Z',
  gradedBy: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  serialNumbers: [],
  imeiNumbers: [],
  ...r,
}));

const ok = (data: unknown) => JSON.stringify({ success: true, data });

async function mockJob(page: Page, buybackValue: number, cost: number) {
  await page.route(`**/api/jobs/${JOB_ID}`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: ok(job(buybackValue, cost)) })
  );
}

test.describe('embed client money wording', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
    await seedSession(page);
    await page.route(`**/api/bookings/${BOOKING_ID}`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: ok(booking) })
    );
    await page.route('**/api/grading?**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: ok(grading) })
    );
  });

  test('the job page says RTG pays the client when the buyback covers the cost', async ({ page }) => {
    const errors = collectPageErrors(page);
    await mockJob(page, 600, 510);
    await page.goto(`/jobs/${JOB_ID}`);

    await expect(page.getByText('RTG pays you', { exact: true })).toBeVisible();
    await expect(page.getByText('£90.00', { exact: true })).toBeVisible();
    await expect(page.getByText(/Client Responsibility/i)).toHaveCount(0);
    // The partner/RTG revenue share never appears in the client's embed.
    await expect(page.getByText(/Revenue share/i)).toHaveCount(0);
    expect(errors, `uncaught page errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('the job page says the client pays RTG when the cost is more than the buyback', async ({ page }) => {
    const errors = collectPageErrors(page);
    await mockJob(page, 0, 510);
    await page.goto(`/jobs/${JOB_ID}`);

    await expect(page.getByText('You pay RTG', { exact: true })).toBeVisible();
    await expect(page.getByText('£510.00').last()).toBeVisible();
    expect(errors, `uncaught page errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('the grading report calls the figure the graded value, not the resale value', async ({ page }) => {
    const errors = collectPageErrors(page);
    await mockJob(page, 93, 0);
    await page.goto(`/bookings/${BOOKING_ID}/grading`);

    await expect(page.getByText('Total Graded Value')).toBeVisible();
    await expect(page.getByText(/resale value/i)).toHaveCount(0);
    expect(errors, `uncaught page errors: ${errors.join(' | ')}`).toEqual([]);
  });
});
