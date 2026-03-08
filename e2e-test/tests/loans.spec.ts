import { test, expect } from '@playwright/test'
import { createBankAccountFromQuickActions, gotoApp } from './helpers/app'

test.describe('Loans @prod-write', () => {
	test('create and cancel a loan', async ({ page }) => {
		await gotoApp(page)

		const accountName = `E2E-LOAN-ACC-${Date.now()}`
		await createBankAccountFromQuickActions(page, accountName)

		await page.locator('a[href="/app/loans"]').first().click()
		await page.waitForURL('**/app/loans')
		await expect(page.getByRole('heading', { level: 1, name: /Loans|Préstamos/i })).toBeVisible()

		const borrowerName = `E2E-BORROWER-${Date.now()}`

		await page.getByRole('button', { name: /New loan|Nuevo préstamo/i }).click()
		const modal = page.getByRole('dialog')
		await expect(modal).toBeVisible()

		await modal.locator('input').first().fill(borrowerName)
		await modal.locator('input[type="number"]').first().fill('10000')
		await modal.locator('input[type="number"]').nth(1).fill('5')

		const sourceSelect = modal.locator('select').first()
		await sourceSelect.selectOption({ label: accountName })

		await modal.getByRole('button', { name: /^Create$|^Crear$/i }).click()
		await expect(modal).not.toBeVisible({ timeout: 20000 })

		const loanRow = page.locator('tr').filter({ hasText: borrowerName })
		await expect(loanRow).toBeVisible({ timeout: 20000 })
		await expect(loanRow.getByText(/active|activo/i)).toBeVisible()

		await loanRow.getByRole('button', { name: /^Cancel$|^Cancelar$/i }).click()

		const cancelDialog = page.getByRole('dialog', { name: /Cancel Loan|Cancelar Préstamo/i })
		await expect(cancelDialog).toBeVisible()
		await cancelDialog.getByRole('button', { name: /Confirm cancellation|Confirmar cancelación/i }).click()
		await expect(cancelDialog).not.toBeVisible({ timeout: 20000 })

		await expect.poll(async () => {
			const text = await loanRow.innerText()
			if (/cancelled|cancelado/i.test(text)) return 'cancelled'
			return 'pending'
		}, { timeout: 20000 }).toBe('cancelled')
	})
})
