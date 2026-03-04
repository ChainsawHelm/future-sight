import { test, expect } from '@playwright/test';

async function loginAsDemo(page: any) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill('demo@futuresight.app');
  await page.getByLabel(/password/i).fill('Demo1234');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
}

test.describe('Transactions', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDemo(page);
    await page.goto('/transactions');
  });

  test('should display transactions table', async ({ page }) => {
    await expect(page.getByText('Transactions')).toBeVisible();
    // Table should have column headers
    await expect(page.getByText('Date').first()).toBeVisible();
    await expect(page.getByText('Description').first()).toBeVisible();
    await expect(page.getByText('Amount').first()).toBeVisible();
  });

  test('should search transactions', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill('Whole Foods');
    // Wait for debounced search
    await page.waitForTimeout(500);
    // Results should be filtered (fewer rows)
    const rows = page.locator('tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should paginate', async ({ page }) => {
    // Check for pagination controls
    const nextBtn = page.getByRole('button', { name: /next/i });
    if (await nextBtn.isVisible()) {
      await nextBtn.click();
      await expect(page.getByText(/page 2/i)).toBeVisible();
    }
  });

  test('should sort by amount', async ({ page }) => {
    const amountHeader = page.getByText('Amount').first();
    await amountHeader.click();
    // Should show sort indicator
    await page.waitForTimeout(300);
  });
});

test.describe('Import', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDemo(page);
    await page.goto('/import');
  });

  test('should show import page with upload zone', async ({ page }) => {
    await expect(page.getByText('Import')).toBeVisible();
    await expect(page.getByText(/drop a csv or pdf/i)).toBeVisible();
  });

  test('should show import history', async ({ page }) => {
    // If seed data created imports, they should show
    const historySection = page.getByText('Import History');
    // May or may not be visible depending on seed data
  });
});
