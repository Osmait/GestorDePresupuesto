import { test, expect, type Locator } from '@playwright/test'
import { createBankAccountFromQuickActions, gotoApp } from './helpers/app'

async function ensureCardBackVisible(card: Locator) {
	const viewDetailsButton = card.getByRole('button', { name: /View details/i })
	if (await viewDetailsButton.isVisible()) {
		await viewDetailsButton.dispatchEvent('click')
	}

	await expect(card.getByRole('button', { name: /Pay Card/i })).toBeVisible()
}

test.describe('Credit Cards @prod-write', () => {
	test('create, update, pay and delete credit card', async ({ page }) => {
		await gotoApp(page)

		const accountName = `E2E-ACC-${Date.now()}`
		await createBankAccountFromQuickActions(page, accountName)

		await page.locator('a[href="/app/credit-cards"]').first().click()
		await page.waitForURL('**/app/credit-cards')
		await expect(page.getByRole('heading', { level: 1, name: /Credit Cards/i })).toBeVisible()

		const cardName = `E2E-CARD-${Date.now()}`
		await page.getByRole('button', { name: /Add Card/i }).click()

		const formModal = page.getByRole('dialog', { name: /Add Credit Card|Edit Credit Card/i })
		await expect(formModal).toBeVisible()

		await formModal.locator('#name').fill(cardName)
		await formModal.locator('#bank').fill('E2E Bank')
		await formModal.locator('#lastFourDigits').fill('1234')
		await formModal.locator('#cutDay').fill('20')
		await formModal.locator('#dueDay').fill('10')
		await formModal.locator('label:has-text("Credit Limit")').first().locator('..').locator('input').first().fill('10000')
		await formModal.locator('label:has-text("Initial Debt")').first().locator('..').locator('input').first().fill('1500')

		await formModal.getByRole('button', { name: /^Create$/i }).click()
		await expect(formModal).not.toBeVisible({ timeout: 20000 })

		const card = page.locator('[data-testid^="credit-card-item-"]').filter({ hasText: cardName }).first()
		await expect(card).toBeVisible({ timeout: 20000 })
		await ensureCardBackVisible(card)

		await card.getByRole('button', { name: /Pay Card/i }).click()
		const paymentModal = page.getByRole('dialog', { name: /Pay Credit Card/i })
		await expect(paymentModal).toBeVisible()

		await paymentModal.locator('button[role="combobox"]').first().click()
		await page.getByRole('option', { name: new RegExp(accountName) }).first().click()
		await paymentModal.locator('#amount').fill('100')

		await paymentModal.getByRole('button', { name: /Make Payment/i }).click()
		await expect(paymentModal).not.toBeVisible({ timeout: 20000 })

		await ensureCardBackVisible(card)
		await card.getByRole('button', { name: /View Payments/i }).dispatchEvent('click')
		const historyModal = page.getByRole('dialog', { name: /Payment History/i })
		await expect(historyModal).toBeVisible()
		await expect(historyModal).toContainText(accountName)
		await page.keyboard.press('Escape')

		// Update card
		await ensureCardBackVisible(card)
		await card.getByRole('button', { name: /Card options/i }).dispatchEvent('pointerdown')
		await expect(page.getByRole('menuitem', { name: /Edit/i })).toBeVisible({ timeout: 10000 })
		await page.getByRole('menuitem', { name: /Edit/i }).click()

		const editModal = page.getByRole('dialog', { name: /Edit Credit Card/i })
		await expect(editModal).toBeVisible()
		const updatedCardName = `${cardName}-UPD`
		await editModal.locator('#name').fill(updatedCardName)
		await editModal.getByRole('button', { name: /Update/i }).click()

		if (await editModal.isVisible()) {
			await page.keyboard.press('Escape')
		}

		const updatedCard = page.locator('[data-testid^="credit-card-item-"]').filter({
			hasText: new RegExp(`${cardName}(-UPD)?`),
		}).first()
		await expect(updatedCard).toBeVisible({ timeout: 20000 })
		await ensureCardBackVisible(updatedCard)

		// Delete card
		await updatedCard.getByRole('button', { name: /Card options/i }).dispatchEvent('pointerdown')
		await expect(page.getByRole('menuitem', { name: /Delete/i })).toBeVisible({ timeout: 10000 })
		await page.getByRole('menuitem', { name: /Delete/i }).click()

		const deleteDialog = page.getByRole('dialog', { name: /Delete Credit Card/i })
		await expect(deleteDialog).toBeVisible()
		await deleteDialog.getByRole('button', { name: /^Delete$/i }).click()
		await expect(updatedCard).not.toBeVisible({ timeout: 20000 })
	})
})
