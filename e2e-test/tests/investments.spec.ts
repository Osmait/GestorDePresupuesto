import { test, expect } from '@playwright/test'
import { createBankAccountFromQuickActions, gotoApp } from './helpers/app'

test.describe('Investments @prod-write', () => {
	test('fund broker, create and delete an investment', async ({ page }) => {
		test.setTimeout(120000)
		await gotoApp(page)

		const investmentName = `E2E-INVEST-${Date.now()}`

		// --- 1. Create a bank account (needed to fund the broker) ---
		const accountName = `E2E-INVEST-ACC-${Date.now()}`
		await createBankAccountFromQuickActions(page, accountName)

		// --- 2. Navigate to the Investments page ---
		await page.locator('a[href="/app/investments"]').first().click()
		await page.waitForURL('**/app/investments')
		await expect(page.getByRole('heading', { level: 1, name: /^(Investments|Inversiones)$/i })).toBeVisible({ timeout: 10000 })

		// --- 3. Fund the broker (required before creating investments) ---
		await page.getByRole('button', { name: /^(Fund broker|Fondear bróker)$/i }).click()

		const fundingModal = page.getByRole('dialog')
		await expect(fundingModal).toBeVisible()

		// Wait for accounts to load and auto-select the first account (useEffect with React Query cache)
		const sourceSelect = fundingModal.getByRole('combobox', { name: /^(Source account|Cuenta de origen)$/i })
		await expect(sourceSelect).not.toHaveText(/Select account|Selecciona una cuenta/i, { timeout: 10000 })

		// Fund from the account created above: the shared demo user may own other
		// accounts (from earlier specs) whose balance is below the amount.
		await sourceSelect.click()
		await page.getByRole('option', { name: new RegExp(`^${accountName} `) }).click()
		await expect(sourceSelect).toContainText(accountName)

		await fundingModal.locator('input[name="sourceAmount"]').fill('5000')

		// If exchange rate field is enabled (currencies differ), fill it
		const exchangeRateInput = fundingModal.locator('input[name="exchangeRate"]')
		const isExchangeRateEnabled = await exchangeRateInput.isEnabled()
		if (isExchangeRateEnabled) {
			await exchangeRateInput.fill('1')
		}

		// Submit via native requestSubmit (avoids button click issues with nested Radix portals)
		await page.evaluate(() => {
			const dialog = document.querySelector('[role="dialog"]')
			const form = dialog?.querySelector('form') as HTMLFormElement | null
			form?.requestSubmit()
		})
		await expect(fundingModal).not.toBeVisible({ timeout: 15000 })

		// --- 4. Open the add investment modal (the header button; an empty tab repeats it) ---
		await page.getByRole('button', { name: /^(Add investment|Agregar inversión)$/i }).first().click()

		const modal = page.getByRole('dialog')
		await expect(modal).toBeVisible()

		// --- 5. Fill in the investment form ---
		await modal.locator('input[name="name"]').fill(investmentName)
		await modal.locator('input[name="symbol"]').fill('AAPL')

		await modal.locator('button[role="combobox"]').first().click()
		await page.getByRole('option', { name: /^(Stock|Acción)$/i }).first().click()

		await modal.locator('input[name="quantity"]').fill('10')
		await modal.locator('input[name="purchase_price"]').fill('150.00')
		await modal.locator('input[name="current_price"]').fill('160.00')

		// --- 6. Submit ---
		await modal.getByRole('button', { name: /^(Create|Crear)$/i }).click()
		await expect(modal).not.toBeVisible({ timeout: 15000 })

		// --- 7. Assert the investment appears ---
		await expect(page.getByText(investmentName).first()).toBeVisible({ timeout: 10000 })

		// --- 8. Delete the investment ---
		// InvestmentCard keeps its actions in a menu (trigger "Actions for <name>" / "Acciones de <name>");
		// Delete asks for confirmation in an alert dialog. Scope to the card containing our investment name.
		const investmentCard = page.locator('div.rounded-lg.border').filter({ hasText: investmentName }).first()
		await expect(investmentCard).toBeVisible({ timeout: 5000 })

		await investmentCard.getByRole('button', { name: new RegExp(`^(Actions for|Acciones de) ${investmentName}$`, 'i') }).click()
		await page.getByRole('menuitem', { name: /^(Delete|Eliminar)$/i }).click()
		const confirmDialog = page.getByRole('alertdialog')
		await expect(confirmDialog).toBeVisible()
		await confirmDialog.getByRole('button', { name: /^(Delete|Eliminar)$/i }).click()

		// --- 9. Assert investment is gone ---
		await expect(investmentCard).not.toBeVisible({ timeout: 15000 })
	})
})
