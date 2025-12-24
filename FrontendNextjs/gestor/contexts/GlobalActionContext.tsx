'use client'

import React, { createContext, useContext, useState, ReactNode, useRef } from 'react'
import { AccountFormModal } from '@/components/accounts/AccountFormModal'
import { CategoryFormModal } from '@/components/categories/CategoryFormModal'
import { CategoryProvider, useCategoryContext } from '@/components/categories/CategoryContext'
import TransactionFormModal from '@/components/transactions/TransactionFormModal'
import { TransactionProvider, useTransactionContext } from '@/components/transactions/TransactionContext'
import { BudgetFormModal } from '@/components/budgets/BudgetFormModal' // BudgetFormModal generally handles its own context or we wrap it
import { BudgetProvider } from '@/components/budgets/BudgetContext'
import { InvestmentFormModal } from '@/components/investments/InvestmentFormModal'
import { useCreateAccountMutation } from '@/hooks/queries/useAccountsQuery'

type ModalType = 'ACCOUNT' | 'CATEGORY' | 'TRANSACTION' | 'BUDGET' | 'INVESTMENT' | null

interface GlobalActionContextType {
    openModal: (type: ModalType) => void
    closeModal: () => void
}

const GlobalActionContext = createContext<GlobalActionContextType | undefined>(undefined)

export function GlobalActionProvider({ children }: { children: ReactNode }) {
    const [activeModal, setActiveModal] = useState<ModalType>(null)
    const { mutateAsync: createAccountMutation, isPending: isAccountLoading, error: accountErrorObj } = useCreateAccountMutation()
    const accountError = accountErrorObj ? (accountErrorObj as Error).message : null

    const handleCreateAccount = async (name: string, bank: string, initial_balance: number) => {
        await createAccountMutation({ name, bank, initial_balance })
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
                    <CategoryModalWrapper
                        isOpen={true}
                        onClose={closeModal}
                    />
                </CategoryProvider>
            )}

            {/* Transaction Modal: Uses TransactionContext */}
            {activeModal === 'TRANSACTION' && (
                <TransactionProvider>
                    <TransactionModalWrapper
                        isOpen={true}
                        onClose={closeModal}
                    />
                </TransactionProvider>
            )}

            {/* Budget Modal: Uses BudgetContext */}
            {activeModal === 'BUDGET' && (
                <BudgetProvider>
                    <BudgetModalWrapper
                        isOpen={true}
                        onClose={closeModal}
                    />
                </BudgetProvider>
            )}

            {/* Investment Modal: Uses hooks internally */}
            {activeModal === 'INVESTMENT' && (
                <InvestmentFormModal
                    isOpen={true}
                    onClose={closeModal}
                    investmentToEdit={null}
                />
            )}
        </GlobalActionContext.Provider>
    )
}

function CategoryModalWrapper({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
    const { createCategory } = useCategoryContext()
    return (
        <CategoryFormModal
            open={isOpen}
            setOpen={(v) => !v && onClose()}
            onCreateCategory={createCategory}
        />
    )
}

function TransactionModalWrapper({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
    const { createTransaction, isLoading, error } = useTransactionContext()
    // Dummy ref as we are not editing
    const formRef = useRef<{ reset: () => void } | null>(null)

    return (
        <TransactionFormModal
            open={isOpen}
            setOpen={(v) => !v && onClose()}
            createTransaction={createTransaction}
            isLoading={isLoading}
            error={error}
            formRef={formRef}
        />
    )
}

function BudgetModalWrapper({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
    // BudgetFormModal uses context internally create/update
    // It accepts setOpen
    return <BudgetFormModal open={isOpen} setOpen={(v) => !v && onClose()} />
}

export function useGlobalAction() {
    const context = useContext(GlobalActionContext)
    if (!context) {
        throw new Error('useGlobalAction must be used within a GlobalActionProvider')
    }
    return context
}
