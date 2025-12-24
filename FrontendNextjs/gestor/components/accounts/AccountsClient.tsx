"use client";
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccountContext } from '@/components/accounts/AccountContext';
import { Account } from '@/types/account';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AnimatedTabs } from '@/components/common/animated-tabs';
import { Button } from '@/components/ui/button';
import { AccountCard } from '@/components/accounts/AccountCard';
import { AccountSummaryCard } from '@/components/accounts/AccountSummaryCard';
import { AccountUpdateModal } from '@/components/accounts/AccountUpdateModal';
import {
  TrendingUp,
  TrendingDown,
  Wallet
} from 'lucide-react';

import { AccountsPageSkeleton } from '@/components/accounts/AccountsPageSkeleton';
import { useTranslations } from 'next-intl';

export default function AccountsClient() {
  const t = useTranslations('accounts');
  const { accounts, isLoading, updateAccount, deleteAccount, error } = useAccountContext();
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);

  // Helper function to get account balance
  const getAccountBalance = (account: any) =>
    account.current_balance ?? account.initial_balance ?? 0;

  // Handle edit account
  const handleEditAccount = (account: Account) => {
    setSelectedAccount(account);
    setUpdateModalOpen(true);
  };

  // Filter functions
  const getFilteredAccounts = (filter: 'all' | 'positive' | 'negative') => {
    if (!Array.isArray(accounts)) return [];

    switch (filter) {
      case 'positive':
        return accounts.filter(account => getAccountBalance(account) > 0);
      case 'negative':
        return accounts.filter(account => getAccountBalance(account) < 0);
      default:
        return accounts;
    }
  };

  if (isLoading) {
    return <AccountsPageSkeleton />;
  }

  const renderTabContent = (filter: 'all' | 'positive' | 'negative') => {
    const filteredAccounts = getFilteredAccounts(filter);
    const emptyMessages = {
      all: t('noAccountsAll'),
      positive: t('noPositiveAccounts'),
      negative: t('noNegativeAccounts')
    };

    if (filteredAccounts.length === 0) {
      return (
        <div className="text-center text-muted-foreground py-8">
          {emptyMessages[filter]}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout" initial={false}>
          {filteredAccounts.map((account) => (
            <motion.div
              key={account.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
            >
              <AccountCard
                account={account}
                onAccountDeleted={() => deleteAccount(account.id!)}
                onAccountEdit={handleEditAccount}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    );
  };

  const tabsConfig = [
    {
      value: 'all',
      label: t('all'),
      icon: <Wallet className="h-4 w-4" />,
      filter: 'all' as const,
    },
    {
      value: 'positive',
      label: t('positive'),
      icon: <TrendingUp className="h-4 w-4" />,
      filter: 'positive' as const,
    },
    {
      value: 'negative',
      label: t('negative'),
      icon: <TrendingDown className="h-4 w-4" />,
      filter: 'negative' as const,
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="mb-8">
        {Array.isArray(accounts) && accounts.length > 0 ? (
          <AccountSummaryCard accounts={accounts} />
        ) : (
          <div className="text-center text-muted-foreground py-8">{t('noAccountsAll')}</div>
        )}
      </div>

      {/* Contenido principal con tabs animados */}
      <AnimatedTabs
        defaultValue="all"
        className="space-y-6"
        tabs={tabsConfig.map(tab => ({
          value: tab.value,
          label: tab.label,
          icon: tab.icon,
          content: renderTabContent(tab.filter)
        }))}
      />

      {/* Información de desarrollo */}
      <Card className="mt-8 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-900/10 dark:to-indigo-900/10 border-blue-200/50 dark:border-blue-800/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-100">
            <Wallet className="h-5 w-5" />
            Información de Desarrollo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="font-semibold text-blue-800 dark:text-blue-200 mb-3">Estado del Sistema:</p>
              <div className="space-y-2">
                <Badge variant="outline" className="bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-800 dark:text-green-400">
                  ✅ Server Component optimizado
                </Badge>
                <Badge variant="outline" className="bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-800 dark:text-green-400">
                  ✅ Data loading en servidor
                </Badge>
              </div>
            </div>
            <div>
              <p className="font-semibold text-blue-800 dark:text-blue-200 mb-3">Datos Disponibles:</p>
              <div className="space-y-2">
                <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-400">
                  🏦 {(accounts?.length ?? 0)} cuentas cargadas
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <AccountUpdateModal
        open={updateModalOpen}
        setOpen={setUpdateModalOpen}
        account={selectedAccount}
        updateAccount={updateAccount}
        isLoading={isLoading}
        error={error}
      />
    </motion.div>
  );
}
