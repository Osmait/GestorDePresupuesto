'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { PlusCircle } from 'lucide-react'
import { AccountFormModal } from '@/components/accounts/AccountFormModal'
import { useAccountContext } from '@/components/accounts/AccountContext'

export function AccountActions() {
    const [modalOpen, setModalOpen] = useState(false)
    const { createAccount, addAccount, isLoading, error } = useAccountContext()

    return (
        <div className="flex items-center gap-3">
            <Button
                className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                onClick={() => setModalOpen(true)}
            >
                <PlusCircle className="h-4 w-4 mr-2" />
                Nueva Cuenta
            </Button>
            <AccountFormModal
                open={modalOpen}
                setOpen={setModalOpen}
                createAccount={async (name, bank, initial_balance) => {
                    // Optimistic Close
                    setModalOpen(false)

                    try {
                        // Optimistic Add
                        const optimisticAccount = {
                            id: `temp-${Date.now()}`,
                            name,
                            bank,
                            initial_balance,
                            current_balance: initial_balance,
                            user_id: 'current',
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        }
                        // @ts-ignore
                        addAccount(optimisticAccount)

                        await createAccount(name, bank, initial_balance)
                    } catch (e) {
                        console.error("Failed to create account", e)
                    }
                }}
                isLoading={isLoading}
                error={error}
            />
        </div>
    )
}
