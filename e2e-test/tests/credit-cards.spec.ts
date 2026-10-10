import { test, expect, type Locator } from '@playwright/test'
import { createBankAccountFromQuickActions, gotoApp } from './helpers/app'

async function ensureCardBackVisible(card: Locator) {
	const viewDetailsButton = card.getByRole('button', { name: /^(View details|Ver detalles)$/i })
	if (await viewDetailsButton.isVisible()) {
		await viewDetailsButton.dispatchEvent('click')
	}

	await expect(card.getByRole('button', { name: /^(Pay Card|Pagar tarjeta)$/i })).toBeVisible()
}

test.describe('Credit Cards @prod-write', () => {
		test('create, update, pay and delete credit card', async ({ page }) => {
		await gotoApp(page)

		const accountName = `E2E-ACC-${Date.now()}`
		await createBankAccountFromQuickActions(page, accountName)

		await page.locator('a[href="/app/credit-cards"]').first().click()
		await page.waitForURL('**/app/credit-cards')
		await expect(page.getByRole('heading', { level: 1, name: /^(Credit Cards|Tarjetas de crédito)$/i })).toBeVisible()

		const cardName = `E2E-CARD-${Date.now()}`
		const lastFour = `${Math.floor(1000 + Math.random() * 9000)}`
		await page.getByRole('button', { name: /^(Add Card|Agregar tarjeta)$/i }).click()

		const formModal = page.getByRole('dialog', { name: /^(Add Credit Card|Agregar tarjeta de crédito)$/i })
		await expect(formModal).toBeVisible()

		await formModal.locator('input[name="name"]').fill(cardName)
		await formModal.locator('input[name="bank"]').fill('E2E Bank')
		await formModal.locator('input[name="lastFourDigits"]').fill(lastFour)
		await formModal.locator('input[name="cutDay"]').fill('20')
		await formModal.locator('input[name="dueDay"]').fill('10')
		await formModal.locator('label:text-matches("Credit Limit|Límite de crédito", "i")').first().locator('..').locator('input').first().fill('10000')
		await formModal.locator('label:text-matches("Initial Debt|Deuda inicial", "i")').first().locator('..').locator('input').first().fill('1500')

		await formModal.getByRole('button', { name: /^(Create|Crear)$/i }).click()

		const card = page.locator('[data-testid^="credit-card-item-"]').filter({ hasText: cardName }).first()
		await expect(card).toBeVisible({ timeout: 40000 })
		await ensureCardBackVisible(card)

		await card.getByRole('button', { name: /^(Pay Card|Pagar tarjeta)$/i }).click()
		const paymentModal = page.getByRole('dialog', { name: /^(Pay Credit Card|Pagar tarjeta de crédito)$/i })
		await expect(paymentModal).toBeVisible()

		await paymentModal.locator('button[role="combobox"]').first().click()
		await page.getByRole('option', { name: new RegExp(accountName) }).first().click()
		await paymentModal.locator('input[name="amount"]').fill('100')

		await paymentModal.getByRole('button', { name: /^(Make Payment|Realizar pago)$/i }).click()
		await expect(paymentModal).not.toBeVisible({ timeout: 20000 })

		await ensureCardBackVisible(card)
		await card.getByRole('button', { name: /^(View Payments|Ver pagos)$/i }).dispatchEvent('click')
		const historyModal = page.getByRole('dialog', { name: /^(Payment History|Historial de pagos)\b/i })
		await expect(historyModal).toBeVisible()
		await expect(historyModal).toContainText(accountName)
		await page.keyboard.press('Escape')

		// Update card
		await ensureCardBackVisible(card)
		await card.getByRole('button', { name: /^(Card options|Opciones de la tarjeta)$/i }).dispatchEvent('pointerdown')
		await expect(page.getByRole('menuitem', { name: /^(Edit|Editar)$/i })).toBeVisible({ timeout: 10000 })
		await page.getByRole('menuitem', { name: /^(Edit|Editar)$/i }).click()

		const editModal = page.getByRole('dialog', { name: /^(Edit Credit Card|Editar tarjeta de crédito)$/i })
		await expect(editModal).toBeVisible()
		const updatedCardName = `${cardName}-UPD`
		await editModal.locator('input[name="name"]').fill(updatedCardName)
		await editModal.getByRole('button', { name: /^(Update|Actualizar)$/i }).click()

		if (await editModal.isVisible()) {
			await page.keyboard.press('Escape')
		}

		const updatedCard = page.locator('[data-testid^="credit-card-item-"]').filter({
			hasText: new RegExp(`${cardName}(-UPD)?`),
		}).first()
		await expect(updatedCard).toBeVisible({ timeout: 20000 })
		await ensureCardBackVisible(updatedCard)

		// Delete card
		await updatedCard.getByRole('button', { name: /^(Card options|Opciones de la tarjeta)$/i }).dispatchEvent('pointerdown')
		await expect(page.getByRole('menuitem', { name: /^(Delete|Eliminar)$/i })).toBeVisible({ timeout: 10000 })
		await page.getByRole('menuitem', { name: /^(Delete|Eliminar)$/i }).click()

		const deleteDialog = page.getByRole('dialog', { name: /^(Delete Credit Card|Eliminar tarjeta de crédito)$/i })
		await expect(deleteDialog).toBeVisible()
		await deleteDialog.getByRole('button', { name: /^(Delete|Eliminar)$/i }).click()
		await expect(updatedCard).not.toBeVisible({ timeout: 20000 })
	})
})
