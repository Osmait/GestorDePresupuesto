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

		// The header button (an empty portfolio repeats it in its empty state)
		await page.getByRole('button', { name: /New loan|Nuevo préstamo/i }).first().click()
		const modal = page.getByRole('dialog')
		await expect(modal).toBeVisible()

		await modal.locator('input').first().fill(borrowerName)
		await modal.locator('input[inputmode="decimal"]').first().fill('3000') // must fit the source account balance (overdrafts are blocked)
		await modal.locator('input[inputmode="decimal"]').nth(1).fill('5')

		// Source account (Radix select)
		await modal.getByRole('combobox').first().click()
		await page.getByRole('option', { name: accountName, exact: true }).click()

		await modal.getByRole('button', { name: /^Create$|^Crear$/i }).click()
		await expect(modal).not.toBeVisible({ timeout: 20000 })

		const loanRow = page.locator('tr').filter({ hasText: borrowerName })
		await expect(loanRow).toBeVisible({ timeout: 20000 })
		await expect(loanRow.getByText(/active|activo/i)).toBeVisible()

		// Secondary actions live in the row menu ("Actions for <borrower>")
		await loanRow.getByRole('button', { name: new RegExp(`^(Actions for|Acciones de) ${borrowerName}$`, 'i') }).click()
		await page.getByRole('menuitem', { name: /^(Cancel loan|Cancelar préstamo)$/i }).click()

		const cancelDialog = page.getByRole('alertdialog', { name: /Cancel Loan|Cancelar Préstamo/i })
		await expect(cancelDialog).toBeVisible()
		await cancelDialog.getByRole('button', { name: /Confirm cancellation|Confirmar cancelación/i }).click()
		await expect(cancelDialog).not.toBeVisible({ timeout: 20000 })

		await expect.poll(async () => {
			const text = await loanRow.innerText()
			if (/cancelled|cancelado/i.test(text)) return 'cancelled'
			return 'pending'
		}, { timeout: 20000 }).toBe('cancelled')
	})

	test('register payment and view details', async ({ page }) => {
		await gotoApp(page)

		const accountName = `E2E-LOAN-PAY-ACC-${Date.now()}`
		await createBankAccountFromQuickActions(page, accountName)

		await page.locator('a[href="/app/loans"]').first().click()
		await page.waitForURL('**/app/loans')

		const borrowerName = `E2E-BORROWER-PAY-${Date.now()}`

		// Create loan
		// The header button (an empty portfolio repeats it in its empty state)
		await page.getByRole('button', { name: /New loan|Nuevo préstamo/i }).first().click()
		const modal = page.getByRole('dialog')
		await expect(modal).toBeVisible()

		await modal.locator('input').first().fill(borrowerName)
		await modal.locator('input[inputmode="decimal"]').first().fill('5000')
		await modal.locator('input[inputmode="decimal"]').nth(1).fill('10')
		await modal.getByRole('combobox').first().click()
		await page.getByRole('option', { name: accountName, exact: true }).click()

		await modal.getByRole('button', { name: /^Create$|^Crear$/i }).click()
		await expect(modal).not.toBeVisible({ timeout: 20000 })

		const loanRow = page.locator('tr').filter({ hasText: borrowerName })
		await expect(loanRow).toBeVisible({ timeout: 20000 })
		await expect(loanRow.getByText(/active|activo/i)).toBeVisible()

		// Register a payment
		await loanRow.getByRole('button', { name: /Register payment|Registrar pago/i }).click()

		const paymentDialog = page.getByRole('dialog')
		await expect(paymentDialog).toBeVisible()

		await paymentDialog.getByRole('combobox').first().click()
		await page.getByRole('option', { name: accountName, exact: true }).click()
		await paymentDialog.locator('input[inputmode="decimal"]').fill('500')
		await paymentDialog.locator('input[type="date"]').fill(new Date().toISOString().slice(0, 10))

		await paymentDialog.getByRole('button', { name: /Confirm payment|Confirmar pago/i }).click()
		await expect(paymentDialog).not.toBeVisible({ timeout: 20000 })

		// View loan details
		await loanRow.getByRole('button', { name: new RegExp(`^(Actions for|Acciones de) ${borrowerName}$`, 'i') }).click()
		await page.getByRole('menuitem', { name: /^Details$|^Detalle$/i }).click()

		const detailsDialog = page.getByRole('dialog', { name: /Loan details|Detalle del préstamo/i })
		await expect(detailsDialog).toBeVisible({ timeout: 20000 })

		await expect(detailsDialog.getByRole('heading', { name: /Installments|Cuotas/i })).toBeVisible({ timeout: 20000 })
		await expect(detailsDialog.getByRole('heading', { name: /Payments|Pagos/i })).toBeVisible({ timeout: 20000 })

		// Close details dialog
		await page.keyboard.press('Escape')
		await expect(detailsDialog).not.toBeVisible({ timeout: 20000 })

		// Cleanup — cancel the loan
		// Secondary actions live in the row menu ("Actions for <borrower>")
		await loanRow.getByRole('button', { name: new RegExp(`^(Actions for|Acciones de) ${borrowerName}$`, 'i') }).click()
		await page.getByRole('menuitem', { name: /^(Cancel loan|Cancelar préstamo)$/i }).click()

		const cancelDialog = page.getByRole('alertdialog', { name: /Cancel Loan|Cancelar Préstamo/i })
		await expect(cancelDialog).toBeVisible()
		await cancelDialog.getByRole('button', { name: /Confirm cancellation|Confirmar cancelación/i }).click()
		await expect(cancelDialog).not.toBeVisible({ timeout: 20000 })
	})
})
