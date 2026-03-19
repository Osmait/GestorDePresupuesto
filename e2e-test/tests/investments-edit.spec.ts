import { test, expect } from '@playwright/test'
import { createBankAccountFromQuickActions, gotoApp } from './helpers/app'

test.describe('Investment Edit @prod-write', () => {
	test('create and edit an investment', async ({ page }) => {
		test.setTimeout(120000)
		await gotoApp(page)

		// --- 1. Create a bank account (needed to fund the broker) ---
		const accountName = `E2E-EDIT-INV-ACC-${Date.now()}`
		await createBankAccountFromQuickActions(page, accountName)

		// --- 2. Navigate to the Investments page ---
		await page.locator('a[href="/app/investments"]').first().click()
		await page.waitForURL('**/app/investments')

		// --- 3. Fund the broker ---
		await page.getByRole('button', { name: /Fund Broker/i }).click()

		const fundingModal = page.getByRole('dialog')
		await expect(fundingModal).toBeVisible()

		// Wait for accounts to load and auto-select (useEffect with React Query cache)
		await expect(fundingModal.locator('button[role="combobox"]').first()).not.toHaveText(/Select account/i, { timeout: 10000 })

		await fundingModal.locator('input[name="sourceAmount"]').fill('5000')

		// Fill exchange rate if the field is enabled (currencies differ)
		const exchangeRateInput = fundingModal.locator('input[name="exchangeRate"]')
		const isExchangeRateEnabled = await exchangeRateInput.isEnabled()
		if (isExchangeRateEnabled) {
			await exchangeRateInput.fill('1')
		}

		// Submit via native requestSubmit (avoids button click issues with nested Radix portals)
		await page.evaluate(() => {
			const form = document.querySelector('[role="dialog"] form') as HTMLFormElement
			form?.requestSubmit()
		})
		await expect(fundingModal).not.toBeVisible({ timeout: 15000 })

		// --- 4. Open the add investment modal ---
		await page.getByRole('button', { name: /Add Investment|Agregar Inversión|Nueva Inversión|New Investment/i }).click()

		const modal = page.getByRole('dialog')
		await expect(modal).toBeVisible()

		// --- 5. Fill in the investment form ---
		const investmentName = `E2E-EDIT-INVEST-${Date.now()}`
		await modal.locator('input[name="name"]').fill(investmentName)
		await modal.locator('input[name="symbol"]').fill('MSFT')

		await modal.locator('button[role="combobox"]').first().click()
		await page.getByRole('option', { name: /^Stock$/i }).first().click()

		await modal.locator('input[name="quantity"]').fill('5')
		await modal.locator('input[name="purchase_price"]').fill('100')
		await modal.locator('input[name="current_price"]').fill('110')

		// --- 6. Submit creation ---
		await modal.getByRole('button', { name: /Create|Crear/i }).click()
		await expect(modal).not.toBeVisible({ timeout: 15000 })

		// --- 7. Assert the investment appears ---
		await expect(page.getByText(investmentName).first()).toBeVisible({ timeout: 10000 })

		// --- 8. Edit the investment ---
		const invCard = page.locator('div.rounded-lg.border').filter({ hasText: investmentName }).first()
		await expect(invCard).toBeVisible({ timeout: 5000 })

		// The edit button has no text or aria-label — locate by the lucide-edit SVG icon
		await invCard.locator('button').filter({ has: page.locator('svg.lucide-square-pen') }).click()

		const editDialog = page.getByRole('dialog')
		await expect(editDialog).toBeVisible()

		const editedName = `${investmentName}-EDITED`
		const nameInput = editDialog.locator('input[name="name"]')
		await nameInput.clear()
		await nameInput.fill(editedName)

		// Submit via native requestSubmit (avoids Radix portal close issues)
		await page.evaluate(() => {
			const dialog = document.querySelector('[role="dialog"]')
			const form = dialog?.querySelector('form') as HTMLFormElement | null
			form?.requestSubmit()
		})
		await expect(editDialog).not.toBeVisible({ timeout: 15000 })

		// --- 9. Assert the edited name is visible ---
		await expect(page.getByText(editedName).first()).toBeVisible({ timeout: 10000 })

		// --- 10. Delete the investment (cleanup) ---
		const editedCard = page.locator('div.rounded-lg.border').filter({ hasText: editedName }).first()
		await expect(editedCard).toBeVisible({ timeout: 5000 })

		// Accept the native confirm() dialog that the delete button triggers
		page.once('dialog', d => d.accept())
		await editedCard.locator('svg.lucide-trash-2').locator('xpath=..').click()

		await expect(editedCard).not.toBeVisible({ timeout: 15000 })
	})
})
