import { test, expect } from '@playwright/test'
import { createBankAccountFromQuickActions, gotoApp, openQuickActions } from './helpers/app'

test.describe('Transactions CRUD @prod-write', () => {
	test('create, edit and delete a transaction', async ({ page }) => {
		await gotoApp(page)

		// --- PREREQUISITES: Account + Category ---
		const accountName = `E2E-TXN-ACC-${Date.now()}`
		await createBankAccountFromQuickActions(page, accountName)

		const categoryName = `E2E-TXN-CAT-${Date.now()}`
		await openQuickActions(page)
		await page.getByRole('menuitem').filter({ hasText: /Category|Categoría/i }).click()

		const categoryModal = page.getByRole('dialog', { name: /Category|Categoría/i })
		await expect(categoryModal).toBeVisible()
		await categoryModal.locator('input[name="name"]').fill(categoryName)
		await categoryModal.locator('button.text-2xl').first().click()
		await categoryModal.locator('.w-6.h-6.rounded-full').first().click()
		await categoryModal.getByRole('button', { name: /Create|Crear/i }).click()
		await expect(categoryModal).not.toBeVisible({ timeout: 15000 })

		// --- CREATE TRANSACTION ---
		const txnName = `E2E Transaction ${Date.now()}`

		await openQuickActions(page)
		await page.getByRole('menuitem').filter({ hasText: /Transaction|Transacción/i }).click()

		const transactionModal = page.getByRole('dialog', { name: /Transaction|Transacción/i })
		await expect(transactionModal).toBeVisible()

		await transactionModal.locator('input[name="name"]').fill(txnName)
		await transactionModal.locator('input[name="amount"]').fill('99.99')

		// Comboboxes: currency (0), type (1), account (2), category (3)
		const selects = transactionModal.locator('button[role="combobox"]')
		await selects.nth(2).click()
		await page.getByRole('option', { name: accountName }).first().click()
		await selects.nth(3).click()
		await page.getByRole('option', { name: categoryName }).first().click()

		await transactionModal.locator('button[type="submit"]').click()
		await expect(transactionModal).not.toBeVisible({ timeout: 15000 })

		// --- NAVIGATE TO TRANSACTIONS PAGE ---
		await page.locator('a[href="/app/transactions"]').first().click()
		await page.waitForURL('**/app/transactions')

		// Use specific text to avoid strict mode violation (multiple h1 on page)
		await expect(page.locator('h1').filter({ hasText: /Transacci/i })).toBeVisible()

		// Confirm the transaction item is listed
		const txnItem = page.locator('[id^="transaction-item-"]').filter({ hasText: txnName })
		await expect(txnItem).toBeVisible({ timeout: 10000 })

		// --- EDIT ---
		await txnItem.locator('button').filter({ has: page.locator('svg.lucide-ellipsis') }).first().click()
		await page.getByRole('menuitem', { name: /Edit|Editar/i }).click()

		const editDialog = page.getByRole('dialog')
		await expect(editDialog).toBeVisible()

		const editedTxnName = `${txnName}-EDITED`
		const nameInput = editDialog.locator('input[name="name"]')
		await nameInput.clear()
		await nameInput.fill(editedTxnName)
		await editDialog.getByRole('button', { name: /Save|Guardar/i }).click()
		await expect(editDialog).not.toBeVisible({ timeout: 15000 })
		await expect(page.getByText(editedTxnName).first()).toBeVisible({ timeout: 10000 })

		// --- DELETE ---
		const editedTxnItem = page.locator('[id^="transaction-item-"]').filter({ hasText: editedTxnName })
		await expect(editedTxnItem).toBeVisible({ timeout: 10000 })
		await editedTxnItem.locator('button').filter({ has: page.locator('svg.lucide-ellipsis') }).first().click()
		await page.getByRole('menuitem', { name: /Delete|Eliminar/i }).click()

		const deleteDialog = page.getByRole('dialog').last()
		await expect(deleteDialog).toBeVisible({ timeout: 5000 })
		await deleteDialog.getByRole('button', { name: /Delete|Eliminar/i }).last().click()

		await expect(page.locator('[id^="transaction-item-"]').filter({ hasText: editedTxnName })).not.toBeVisible({ timeout: 15000 })
	})
})
