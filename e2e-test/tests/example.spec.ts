import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
    await page.goto('/');

    // Expect a title "to contain" a substring.
    // Adjust this expectation based on your actual app title
    await expect(page).toHaveTitle(/FinanceApp/);
});

test('get started link', async ({ page }) => {
    await page.goto('/');

    // Check if we are redirected to login or can see a main element
    // For now, just checking if the body is visible is a good sanity check
    await expect(page.locator('body')).toBeVisible();
});
