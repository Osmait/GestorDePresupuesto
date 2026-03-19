import { test, expect } from '@playwright/test'
import { createBankAccountFromQuickActions, gotoApp, openQuickActions } from './helpers/app'

test.describe('Recurring Transactions @prod-write', () => {
	test('create and delete a recurring transaction', async ({ page }) => {
		await gotoApp(page)

		// --- 1. Create prerequisite bank account ---
		const accountName = `E2E-REC-ACC-${Date.now()}`
		await createBankAccountFromQuickActions(page, accountName)

		// --- 2. Create prerequisite category ---
		const categoryName = `E2E-REC-CAT-${Date.now()}`
		await openQuickActions(page)
		await page.getByRole('menuitem').filter({ hasText: /Category|Categoría/i }).click()

		const categoryModal = page.getByRole('dialog', { name: /Category|Categoría/i })
		await expect(categoryModal).toBeVisible()
		await categoryModal.locator('input[name="name"]').fill(categoryName)
		await categoryModal.locator('button.text-2xl').first().click()
		await categoryModal.locator('.w-6.h-6.rounded-full').first().click()
		await categoryModal.getByRole('button', { name: /Create|Crear/i }).click()
		await expect(categoryModal).not.toBeVisible({ timeout: 15000 })

		// --- 3. Navigate to Transactions → Recurring tab ---
		await page.locator('a[href="/app/transactions"]').first().click()
		await page.waitForURL('**/app/transactions**')

		const recurringTab = page.getByRole('tab', { name: /Recurring|Recurrente/i })
		if (await recurringTab.isVisible()) {
			await recurringTab.click()
		} else {
			await page.locator('[data-value="recurring"]').click()
		}

		// --- 4. Open the add recurring transaction modal ---
		await page.getByRole('button', { name: /Nueva Recurrente|New Recurring/i }).click()

		const modal = page.getByRole('dialog')
		await expect(modal).toBeVisible()

		// --- 5. Fill in the form ---
		const recurringName = `E2E-Recurring-${Date.now()}`

		await modal.locator('input[name="name"]').fill(recurringName)
		await modal.locator('input[name="amount"]').fill('200')
		await modal.locator('input[name="day_of_month"]').fill('15')

		// All selects use Shadcn combobox (button[role="combobox"])
		// Order: type (0), category (1), account (2)
		const comboboxes = modal.locator('button[role="combobox"]')

		await comboboxes.nth(0).click()
		await page.getByRole('option', { name: /Gasto|Expense/i }).first().click()

		await comboboxes.nth(1).click()
		await page.getByRole('option', { name: new RegExp(categoryName) }).first().click()

		await comboboxes.nth(2).click()
		await page.getByRole('option', { name: new RegExp(accountName) }).first().click()

		// --- 6. Submit ---
		await modal.getByRole('button', { name: /^Crear$|^Create$/i }).click()
		await expect(modal).not.toBeVisible({ timeout: 15000 })

		// --- 7. Assert the recurring transaction card appears ---
		await expect(page.getByText(recurringName).first()).toBeVisible({ timeout: 10000 })

		// --- 8. Delete ---
		page.once('dialog', dialog => dialog.accept())

		await page.locator('button').filter({ has: page.locator('svg.lucide-ellipsis') }).first().click()
		await page.getByRole('menuitem', { name: /Delete|Eliminar/i }).click()

		const alertDialog = page.getByRole('dialog').last()
		if (await alertDialog.isVisible()) {
			await alertDialog.getByRole('button', { name: /Delete|Eliminar|Confirm|Confirmar/i }).last().click()
		}

		await expect(page.getByText(recurringName).first()).not.toBeVisible({ timeout: 15000 })
	})
})
