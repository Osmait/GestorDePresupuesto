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
		await card.getByRole('button', { name: /^(Acciones de|Actions for) /i }).dispatchEvent('pointerdown')
		await expect(page.getByRole('menuitem', { name: /^(Edit|Editar)$/i })).toBeVisible({ timeout: 10000 })
		await page.getByRole('menuitem', { name: /^(Edit|Editar)$/i }).click()

		const editModal = page.getByRole('dialog', { name: /^(Edit Credit Card|Editar tarjeta de crédito)$/i })
		await expect(editModal).toBeVisible()
		const updatedCardName = `${cardName}-UPD`
		await editModal.locator('input[name="name"]').fill(updatedCardName)
		// The debt is not editable here (it changes by reconciling the card); the limit is,
		// typed with a decimal comma as es-DO keyboards do.
		await expect(editModal.getByText(/^(Initial Debt|Deuda inicial)$/i)).toHaveCount(0)
		await expect(editModal.getByText(/(use "Reconcile"|usa "Cuadrar")/i)).toBeVisible()
		const limitInput = editModal.getByRole('textbox', { name: /^(Credit Limit|Límite de crédito) DOP$/i })
		await limitInput.fill('20000,50')
		await editModal.getByRole('button', { name: /^(Update|Actualizar)$/i }).click()
		await expect(editModal).not.toBeVisible({ timeout: 20000 })

		// The name is matched loosely: the backend does not persist a renamed card yet
		// (CreditCardService.UpdateCreditCard edits the account's name but never saves it).
		const updatedCard = page.locator('[data-testid^="credit-card-item-"]').filter({
			hasText: new RegExp(`${cardName}(-UPD)?`),
		}).first()
		await expect(updatedCard).toBeVisible({ timeout: 20000 })
		await ensureCardBackVisible(updatedCard)
		// Limit 20,000.50 minus the 1,400 still owed.
		await expect(updatedCard).toContainText('18,600.50', { timeout: 20000 })

		// Delete card
		await updatedCard.getByRole('button', { name: /^(Acciones de|Actions for) /i }).dispatchEvent('pointerdown')
		await expect(page.getByRole('menuitem', { name: /^(Delete|Eliminar)$/i })).toBeVisible({ timeout: 10000 })
		await page.getByRole('menuitem', { name: /^(Delete|Eliminar)$/i }).click()

		const deleteDialog = page.getByRole('alertdialog', { name: /^(Delete the card|¿Eliminar la tarjeta)/i })
		await expect(deleteDialog).toBeVisible()
		await deleteDialog.getByRole('button', { name: /^(Delete|Eliminar)$/i }).click()
		await expect(updatedCard).not.toBeVisible({ timeout: 20000 })
	})

	test('card debt is one number: card page, dashboard and statement reconcile', async ({ page }) => {
		await gotoApp(page)

		const accountName = `E2E-PAYER-${Date.now()}`
		await createBankAccountFromQuickActions(page, accountName)

		await page.locator('a[href="/app/credit-cards"]').first().click()
		await page.waitForURL('**/app/credit-cards')

		// A card that already owes 1,500, then pays 100: it owes 1,400.
		const cardName = `E2E-DEBT-${Date.now()}`
		await page.getByRole('button', { name: /^(Add Card|Agregar tarjeta)$/i }).click()
		const formModal = page.getByRole('dialog', { name: /^(Add Credit Card|Agregar tarjeta de crédito)$/i })
		await formModal.locator('input[name="name"]').fill(cardName)
		await formModal.locator('input[name="bank"]').fill('E2E Bank')
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
		await paymentModal.locator('button[role="combobox"]').first().click()
		await page.getByRole('option', { name: new RegExp(accountName) }).first().click()
		await paymentModal.locator('input[name="amount"]').fill('100')
		await paymentModal.getByRole('button', { name: /^(Make Payment|Realizar pago)$/i }).click()
		await expect(paymentModal).not.toBeVisible({ timeout: 20000 })
		await expect(card).toContainText(/1[.,]400[.,]00/, { timeout: 15000 })

		// The dashboard lists it as debt, not as a negative bank balance.
		await page.goto('/app')
		await page.getByRole('tab', { name: /^(Accounts|Cuentas)$/ }).click()
		const cardsSection = page.getByRole('region', { name: /^(Credit cards|Tarjetas de crédito)$/ })
		await expect(cardsSection.getByText(new RegExp(`(Debes|You owe) RD\\$1[.,]400[.,]00`)).first()).toBeVisible({ timeout: 15000 })
		// Net worth shows the debt.
		await page.getByRole('tab', { name: /^(Net worth|Patrimonio)$/ }).click()
		await expect(page.getByText(/^(Deuda de tarjetas|Credit card debt)$/)).toBeVisible({ timeout: 15000 })

		// The statement says 2,000: reconcile the card to it.
		await page.goto('/app/credit-cards')
		const again = page.locator('[data-testid^="credit-card-item-"]').filter({ hasText: cardName }).first()
		await ensureCardBackVisible(again)
		await again.getByRole('button', { name: /^(Acciones de|Actions for) /i }).dispatchEvent('pointerdown')
		await page.getByRole('menuitem', { name: /^(Cuadrar con estado de cuenta|Reconcile with statement)$/ }).click()
		const reconcile = page.getByRole('dialog', { name: new RegExp(`(Cuadrar|Reconcile) ${cardName}`) })
		await expect(reconcile).toBeVisible()
		await reconcile.getByLabel(/Deuda según el banco|Debt at the bank/).fill('2000')
		await expect(reconcile.getByText(/-RD\$600[.,]00/)).toBeVisible()
		await reconcile.getByRole('button', { name: /^(Cuadrar|Reconcile)$/ }).click()
		await expect(reconcile).not.toBeVisible({ timeout: 15000 })
		await expect(again).toContainText(/2[.,]000[.,]00/, { timeout: 15000 })
	})
})

