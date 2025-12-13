'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { PlusCircle } from 'lucide-react'
import { AccountFormModal } from '@/components/accounts/AccountFormModal'
import { useAccounts } from '@/hooks/useRepositories'

export function AccountActions() {
    const [modalOpen, setModalOpen] = useState(false)
    const { createAccount, isLoading, error } = useAccounts()

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
                createAccount={createAccount}
                isLoading={isLoading} // Assuming isLoading is relevant for creation
                error={error}
            />
        </div>
    )
}
