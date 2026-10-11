import { test, expect } from '@playwright/test'
import { gotoApp } from './helpers/app'

test.describe('Certificates @prod-write', () => {
	test('create, update, inspect and cancel certificate', async ({ page }) => {
		await gotoApp(page)

		await page.locator('a[href="/app/certificates"]').first().click()
		await page.waitForURL('**/app/certificates')
		await expect(page.getByRole('heading', { level: 1, name: /^(Certificates|Certificados)$/i })).toBeVisible()

		const bankName = `E2E-CERT-${Date.now()}`

		// The header button (an empty list repeats it in its empty state)
		await page.getByRole('button', { name: /^(New certificate|Nuevo certificado)$/i }).first().click()
		const modal = page.getByRole('dialog', { name: /^(New certificate|Nuevo certificado)$/i })
		await expect(modal).toBeVisible()

		await modal.locator('input[name="bank"]').fill(bankName)
		await modal.locator('input[name="base_capital"]').fill('25000')
		await modal.locator('input[name="current_interest_rate"]').fill('8')
		await modal.locator('input[name="current_tax_rate"]').fill('10')

		await modal.locator('button[role="combobox"]').first().click()
		await page.getByRole('option', { name: /^(Compound interest|Interés compuesto)$/i }).click()

		await modal.getByRole('button', { name: /^(Create|Crear)$/i }).click()
		await expect(modal).not.toBeVisible({ timeout: 20000 })

		const certificateCard = page.locator('[class*="card"]:visible').filter({ hasText: bankName }).first()
		await expect(certificateCard).toBeVisible({ timeout: 20000 })

		// Card actions live in a menu ("Actions for <bank>" / "Acciones de <bank>")
		const openCardMenu = (card: typeof certificateCard) =>
			card.getByRole('button', { name: /^(Actions for|Acciones de) /i }).click()

		await openCardMenu(certificateCard)
		await page.getByRole('menuitem', { name: /^(History|Historial)$/i }).click()
		await expect(page.getByRole('dialog', { name: /Payment history|Historial de pagos/i })).toBeVisible()
		await page.keyboard.press('Escape')

		await page.getByRole('button', { name: /^(Simulator|Simulador)$/i }).click()
		await expect(page.getByRole('dialog', { name: /Certificate simulator|Simulador de certificado/i })).toBeVisible()
		await page.keyboard.press('Escape')

		// Update
		await openCardMenu(certificateCard)
		await page.getByRole('menuitem', { name: /^(Edit|Editar)$/i }).click()
		const editModal = page.getByRole('dialog', { name: /^(Edit certificate|Editar certificado)$/i })
		await expect(editModal).toBeVisible()

		const updatedBankName = `${bankName}-UPD`
		await editModal.locator('input[name="bank"]').fill(updatedBankName)
		await editModal.getByRole('button', { name: /^(Update|Actualizar)$/i }).click()
		await expect(editModal).not.toBeVisible({ timeout: 20000 })

		const updatedCard = page.locator('[class*="card"]:visible').filter({ hasText: updatedBankName }).first()
		await expect(updatedCard).toBeVisible({ timeout: 20000 })

		// Cancel (delete), confirmed in an alert dialog
		await openCardMenu(updatedCard)
		await page.getByRole('menuitem', { name: /^(Cancel certificate|Cancelar certificado)$/i }).click()
		const cancelDialog = page.getByRole('alertdialog')
		await expect(cancelDialog).toBeVisible()
		await cancelDialog.getByRole('button', { name: /^(Cancel certificate|Cancelar certificado)$/i }).click()
		await expect(cancelDialog).not.toBeVisible({ timeout: 20000 })
		await expect.poll(async () => {
			const cards = page.locator('[class*="card"]:visible').filter({ hasText: updatedBankName })
			const count = await cards.count()
			if (count === 0) return 'removed'
			const text = await cards.first().innerText()
			if (/Cancelled|Cancelado/i.test(text)) return 'cancelled'
			return 'pending'
		}, { timeout: 20000 }).toMatch(/removed|cancelled/)
	})

	test('edit a certificate payment', async ({ page }) => {
		await gotoApp(page)

		await page.locator('a[href="/app/certificates"]').first().click()
		await page.waitForURL('**/app/certificates')

		// Payments are generated lazily by the backend when listing certificates.
		// A freshly created certificate won't have payments until its first cutDay
		// passes, so we look for any existing certificate that already has payments.
		const menuButtons = page.getByRole('button', { name: /^(Actions for|Acciones de) /i })
		const count = await menuButtons.count()
		test.skip(count === 0, 'No existing certificates found to test payment edit')

		let foundPayments = false
		const historyDialog = page.getByRole('dialog', { name: /Payment history|Historial de pagos/i })

		for (let i = 0; i < count; i++) {
			await menuButtons.nth(i).click()
			await page.getByRole('menuitem', { name: /^(History|Historial)$/i }).click()
			await expect(historyDialog).toBeVisible()

			const editBtn = historyDialog.getByRole('button', { name: /^(Edit payment|Editar pago)$/i }).first()
			try {
				await editBtn.waitFor({ state: 'visible', timeout: 3000 })
				foundPayments = true
				break
			} catch {
				await page.keyboard.press('Escape')
				await expect(historyDialog).not.toBeVisible()
			}
		}

		test.skip(!foundPayments, 'No certificates with existing payments found')

		// Click edit on the first payment
		const editButton = historyDialog.getByRole('button', { name: /^(Edit payment|Editar pago)$/i }).first()
		await editButton.click()
		const editDialog = page.getByRole('dialog', { name: /^(Edit payment|Editar pago)$/i })
		await expect(editDialog).toBeVisible()

		// Change gross_interest
		const grossInput = editDialog.locator('input[name="gross_interest"]')
		await grossInput.fill('999.99')

		await editDialog.getByRole('button', { name: /^(Save|Guardar)$/i }).click()
		await expect(editDialog).not.toBeVisible({ timeout: 10000 })

		// Verify the updated value appears in the table
		await expect(historyDialog.getByText(/999[.,]99/).first()).toBeVisible({ timeout: 10000 })

		await page.keyboard.press('Escape')
	})
})
