import { test, expect } from '@playwright/test'
import { createBankAccountFromQuickActions, gotoApp } from './helpers/app'

test.describe('Account reconcile @prod-write', () => {
	test('reconcile an account with the bank balance writes one non-editable adjustment', async ({ page }) => {
		await gotoApp(page)

		// --- 1. A bank account with an initial balance of 5000 ---
		const accountName = `E2E-RECONCILE-${Date.now()}`
		await createBankAccountFromQuickActions(page, accountName)

		await page.locator('a[href="/app/accounts"]').first().click()
		await page.waitForURL('**/app/accounts')
		await expect(page.getByText(accountName).first()).toBeVisible({ timeout: 10000 })
		await expect(page.getByText(/Nunca cuadrada|Never reconciled/).first()).toBeVisible()

		// --- 2. Reconcile from the card menu: the bank shows 5,250.75 ---
		await page.getByRole('button', { name: new RegExp(`(Acciones de|Actions for) ${accountName}`) }).click()
		await page.getByRole('menuitem', { name: /Cuadrar saldo|Reconcile balance/ }).click()

		const dialog = page.getByRole('dialog', { name: new RegExp(`(Cuadrar|Reconcile) ${accountName}`) })
		await expect(dialog).toBeVisible()
		await dialog.getByLabel(/Saldo en el banco|Balance at the bank/).fill('5250.75')
		await expect(dialog.getByText(/\+RD\$250[.,]75/)).toBeVisible()
		await dialog.getByLabel(/Nota|Note/).fill('e2e statement')
		await dialog.getByRole('button', { name: /^(Cuadrar|Reconcile)$/ }).click()
		await expect(dialog).not.toBeVisible({ timeout: 15000 })

		// --- 3. The card shows the bank balance and a fresh reconciliation ---
		const card = page.locator('div.relative', { has: page.getByRole('link', { name: accountName }) }).first()
		await expect(card.getByText(/RD\$5[.,]250[.,]75/).first()).toBeVisible({ timeout: 10000 })
		await expect(card.getByText(/Cuadrada hoy|Reconciled today/)).toBeVisible()

		// --- 4. Detail page: history entry and the adjustment in the ledger ---
		await page.getByRole('link', { name: accountName }).click()
		await page.waitForURL('**/app/accounts/**', { timeout: 10000 })
		await expect(page.getByRole('heading', { name: /Historial de cuadres|Reconciliation history/ })).toBeVisible()
		await expect(page.getByText('e2e statement').first()).toBeVisible()

		const adjustmentRow = page.getByRole('button', { name: /(Acciones de|Actions for) (Ajuste de saldo|Balance adjustment)/ })
		await expect(adjustmentRow).toBeVisible()

		// It can be deleted (undo) but not edited (the form would turn it into an expense).
		await adjustmentRow.click()
		await expect(page.getByRole('menuitem', { name: /Eliminar transacción|Delete transaction/ })).toBeVisible()
		await expect(page.getByRole('menuitem', { name: /Editar transacción|Edit transaction/ })).toHaveCount(0)
		await page.keyboard.press('Escape')

		// --- 5. Reconciling again with the same balance needs no adjustment ---
		await page.getByRole('button', { name: /Cuadrar saldo|Reconcile balance/ }).click()
		const again = page.getByRole('dialog', { name: new RegExp(`(Cuadrar|Reconcile) ${accountName}`) })
		await again.getByLabel(/Saldo en el banco|Balance at the bank/).fill('5250.75')
		await expect(again.getByText(/Coincide|Matches/)).toBeVisible()
		await again.getByRole('button', { name: /^(Cuadrar|Reconcile)$/ }).click()
		await expect(again).not.toBeVisible({ timeout: 15000 })
		await expect(page.getByText(/Sin ajuste|No adjustment/).first()).toBeVisible({ timeout: 10000 })
	})
})
