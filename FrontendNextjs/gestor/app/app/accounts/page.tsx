'use client'

import { AccountActions } from '@/components/accounts/AccountActions'
import AccountsClient from '@/components/accounts/AccountsClient'
import { AccountProvider } from '@/components/accounts/AccountContext'
import { useTranslations } from 'next-intl'

export default function AccountsPage() {
  const t = useTranslations('accounts')
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 dark:from-background dark:via-background dark:to-muted/20">
      <div className="container mx-auto px-4 py-8">
        <AccountProvider>
          <div className="mb-8" id="accounts-header">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h1 className="text-4xl font-bold tracking-tight text-foreground">
                  {t('title')}
                </h1>
                <p className="text-muted-foreground mt-2 text-lg">
                  {t('subtitle')}
                </p>
              </div>
              <div id="add-account-btn">
                <AccountActions />
              </div>
            </div>
          </div>

          <div id="accounts-list">
            <AccountsClient />
          </div>
        </AccountProvider>
      </div>
    </div>
  )
}

