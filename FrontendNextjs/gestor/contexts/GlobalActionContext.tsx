'use client'

import { useRouter } from 'next/navigation'
import { createContext, ReactNode, useCallback, useContext, useState } from 'react'
import { AccountFormModal } from '@/components/accounts/AccountFormModal'
import { BudgetProvider } from '@/components/budgets/BudgetContext'
import { BudgetFormModal } from '@/components/budgets/BudgetFormModal' // BudgetFormModal generally handles its own context or we wrap it
import { CategoryProvider, useCategoryContext } from '@/components/categories/CategoryContext'
import { CategoryFormModal } from '@/components/categories/CategoryFormModal'
import { InvestmentFormModal } from '@/components/investments/InvestmentFormModal'
import { TransactionProvider, useTransactionContext } from '@/components/transactions/TransactionContext'
import TransactionFormModal from '@/components/transactions/TransactionFormModal'
import { useCreateAccountMutation } from '@/hooks/queries/useAccountsQuery'

type ModalType = 'ACCOUNT' | 'CATEGORY' | 'TRANSACTION' | 'BUDGET' | 'INVESTMENT' | null

interface GlobalActionContextType {
	openModal: (type: ModalType) => void
	closeModal: () => void
}

const GlobalActionContext = createContext<GlobalActionContextType | undefined>(undefined)

export function GlobalActionProvider({ children }: { children: ReactNode }) {
	const router = useRouter()
	const [activeModal, setActiveModal] = useState<ModalType>(null)

	/*
	 * Called after every successful create launched from the global "+" menu.
	 * The mutation hooks already invalidate the TanStack Query caches (accounts,
	 * transactions, budgets, analytics...); router.refresh() re-renders the
	 * Server Components (the dashboard fetches its data on the server) so the
	 * page behind the modal shows the new data without a manual reload.
	 */
	const onDataChanged = useCallback(() => {
		router.refresh()
	}, [router])
	const {
		mutateAsync: createAccountMutation,
		isPending: isAccountLoading,
		error: accountErrorObj,
	} = useCreateAccountMutation()
	const accountError = accountErrorObj ? (accountErrorObj as Error).message : null

	const handleCreateAccount = async (name: string, bank: string, initial_balance: number) => {
		await createAccountMutation({ name, bank, initial_balance })
		onDataChanged()
		closeModal()
	}

	const openModal = (type: ModalType) => setActiveModal(type)
	const closeModal = () => setActiveModal(null)

	return (
		<GlobalActionContext.Provider value={{ openModal, closeModal }}>
			{children}

			{/* Account Modal: Uses GLOBAL useAuth/useAccounts hooks, no provider needed */}
			<AccountFormModal
				open={activeModal === 'ACCOUNT'}
				setOpen={(open) => !open && closeModal()}
				createAccount={handleCreateAccount}
				isLoading={isAccountLoading}
				error={accountError}
			/>

			{/* Category Modal: Uses CategoryContext */}
			{activeModal === 'CATEGORY' && (
				<CategoryProvider>
					<CategoryModalWrapper isOpen={true} onClose={closeModal} onCreated={onDataChanged} />
				</CategoryProvider>
			)}

			{/* Transaction Modal: Uses TransactionContext */}
			{activeModal === 'TRANSACTION' && (
				<TransactionProvider syncUrl={false} fetchTransactions={false}>
					<TransactionModalWrapper isOpen={true} onClose={closeModal} onCreated={onDataChanged} />
				</TransactionProvider>
			)}

			{/* Budget Modal: Uses BudgetContext */}
			{activeModal === 'BUDGET' && (
				<BudgetProvider>
					<BudgetModalWrapper isOpen={true} onClose={closeModal} onCreated={onDataChanged} />
				</BudgetProvider>
			)}

			{/* Investment Modal: Uses hooks internally */}
			{activeModal === 'INVESTMENT' && (
				<InvestmentFormModal
					isOpen={true}
					onClose={() => {
						// InvestmentFormModal has no success callback; refreshing on close is cheap.
						onDataChanged()
						closeModal()
					}}
					investmentToEdit={null}
				/>
			)}
		</GlobalActionContext.Provider>
	)
}

interface ModalWrapperProps {
	isOpen: boolean
	onClose: () => void
	onCreated: () => void
}

function CategoryModalWrapper({ isOpen, onClose, onCreated }: ModalWrapperProps) {
	const { createCategory } = useCategoryContext()
	return (
		<CategoryFormModal
			open={isOpen}
			setOpen={(v) => !v && onClose()}
			onCreateCategory={async (...args) => {
				await createCategory(...args)
				onCreated()
			}}
		/>
	)
}

function TransactionModalWrapper({ isOpen, onClose, onCreated }: ModalWrapperProps) {
	const { createTransaction, isLoading, error } = useTransactionContext()

	return (
		<TransactionFormModal
			open={isOpen}
			setOpen={(v) => !v && onClose()}
			createTransaction={async (...args) => {
				await createTransaction(...args)
				onCreated()
			}}
			isLoading={isLoading}
			error={error}
		/>
	)
}

function BudgetModalWrapper({ isOpen, onClose, onCreated }: ModalWrapperProps) {
	// BudgetFormModal creates through BudgetContext and closes itself through setOpen.
	return <BudgetFormModal open={isOpen} setOpen={(v) => !v && onClose()} onSaved={onCreated} />
}

export function useGlobalAction() {
	const context = useContext(GlobalActionContext)
	if (!context) {
		throw new Error('useGlobalAction must be used within a GlobalActionProvider')
	}
	return context
}
