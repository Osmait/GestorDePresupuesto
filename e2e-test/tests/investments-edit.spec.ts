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

		// --- 4. Open the add investment modal (the header button; an empty tab repeats it) ---
		await page.getByRole('button', { name: /^(Add investment|Agregar inversión)$/i }).first().click()

		const modal = page.getByRole('dialog')
		await expect(modal).toBeVisible()

		// --- 5. Fill in the investment form ---
		const investmentName = `E2E-EDIT-INVEST-${Date.now()}`
		await modal.locator('input[name="name"]').fill(investmentName)
		await modal.locator('input[name="symbol"]').fill('MSFT')

		await modal.locator('button[role="combobox"]').first().click()
		await page.getByRole('option', { name: /^(Stock|Acción)$/i }).first().click()

		await modal.locator('input[name="quantity"]').fill('5')
		await modal.locator('input[name="purchase_price"]').fill('100')
		await modal.locator('input[name="current_price"]').fill('110')

		// --- 6. Submit creation ---
		await modal.getByRole('button', { name: /^(Create|Crear)$/i }).click()
		await expect(modal).not.toBeVisible({ timeout: 15000 })

		// --- 7. Assert the investment appears ---
		await expect(page.getByText(investmentName).first()).toBeVisible({ timeout: 10000 })

		// --- 8. Edit the investment ---
		const invCard = page.locator('div.rounded-lg.border').filter({ hasText: investmentName }).first()
		await expect(invCard).toBeVisible({ timeout: 5000 })

		await invCard.getByRole('button', { name: new RegExp(`^(Actions for|Acciones de) ${investmentName}$`, 'i') }).click()
		await page.getByRole('menuitem', { name: /^(Edit|Editar)$/i }).click()

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

		// Delete from the card's actions menu and confirm in the alert dialog
		await editedCard.getByRole('button', { name: new RegExp(`^(Actions for|Acciones de) ${editedName}$`, 'i') }).click()
		await page.getByRole('menuitem', { name: /^(Delete|Eliminar)$/i }).click()
		const confirmDialog = page.getByRole('alertdialog')
		await expect(confirmDialog).toBeVisible()
		await confirmDialog.getByRole('button', { name: /^(Delete|Eliminar)$/i }).click()

		await expect(editedCard).not.toBeVisible({ timeout: 15000 })
	})
})
