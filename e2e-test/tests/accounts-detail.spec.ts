import { test, expect } from '@playwright/test'
import { createBankAccountFromQuickActions, gotoApp } from './helpers/app'

test.describe('Account Detail @prod-write', () => {
	test('navigate to account detail and verify content', async ({ page }) => {
		await gotoApp(page)

		// --- 1. Create a bank account via quick actions (initial balance: 5000) ---
		const accountName = `E2E-DETAIL-ACC-${Date.now()}`
		await createBankAccountFromQuickActions(page, accountName)

		// --- 2. Navigate to the Accounts list page ---
		await page.locator('a[href="/app/accounts"]').first().click()
		await page.waitForURL('**/app/accounts')

		// --- 3. Assert the new account card is visible ---
		await expect(page.getByText(accountName).first()).toBeVisible({ timeout: 10000 })

		// --- 4. Click the account name text to navigate to the detail page ---
		// Clicking the name text avoids accidentally hitting the edit/delete buttons on the card
		await page.getByText(accountName).first().click()
		await page.waitForURL('**/app/accounts/**', { timeout: 10000 })

		// --- 5. Assert detail page content ---
		await expect(page.getByRole('heading', { level: 1, name: accountName })).toBeVisible()
		await expect(page.getByText('Volver a Cuentas')).toBeVisible()
		await expect(page.getByText('Detalles')).toBeVisible()

		// --- 6. Assert the initial balance (5000) is displayed ---
		await expect(page.getByText(/5\.000|5,000|5000/i).first()).toBeVisible()
	})
})
