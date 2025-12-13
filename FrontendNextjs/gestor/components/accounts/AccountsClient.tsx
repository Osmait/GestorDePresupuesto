"use client";
import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAccounts } from '@/hooks/useRepositories';
import { Account } from '@/types/account';
import { PlusCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AnimatedTabs } from '@/components/common/animated-tabs';
import { Button } from '@/components/ui/button';
import { AccountCard } from '@/components/accounts/AccountCard';
import { AccountSummaryCard } from '@/components/accounts/AccountSummaryCard';
import { AccountFormModal } from '@/components/accounts/AccountFormModal';
import { AccountUpdateModal } from '@/components/accounts/AccountUpdateModal';
import {
  TrendingUp,
  TrendingDown,
  Wallet
} from 'lucide-react';

import { AccountsPageSkeleton } from '@/components/accounts/AccountsPageSkeleton';

export default function AccountsClient() {
  const { accounts, isLoading, createAccount, updateAccount, deleteAccount, error } = useAccounts();
  const [modalOpen, setModalOpen] = useState(false);
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

  // Render content for each tab
  const renderTabContent = (filter: 'all' | 'positive' | 'negative') => {
    const filteredAccounts = getFilteredAccounts(filter);
    const emptyMessages = {
      all: 'No tienes cuentas registradas.',
      positive: 'No tienes cuentas positivas.',
      negative: 'No tienes cuentas negativas.'
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
        {filteredAccounts.map((account) => (
          <AccountCard
            key={account.id}
            account={account}
            onAccountDeleted={() => deleteAccount(account.id!)}
            onAccountEdit={handleEditAccount}
          />
        ))}
      </div>
    );
  };

  // Tab configuration
  const tabsConfig = [
    {
      value: 'all',
      label: 'Todas',
      icon: <Wallet className="h-4 w-4" />,
      filter: 'all' as const,
    },
    {
      value: 'positive',
      label: 'Positivas',
      icon: <TrendingUp className="h-4 w-4" />,
      filter: 'positive' as const,
    },
    {
      value: 'negative',
      label: 'Negativas',
      icon: <TrendingDown className="h-4 w-4" />,
      filter: 'negative' as const,
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 dark:from-background dark:via-background dark:to-muted/20">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="container mx-auto px-4 py-8"
      >
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-foreground via-primary to-primary bg-clip-text text-transparent">
                Gestión de Cuentas
              </h1>
              <p className="text-muted-foreground mt-2 text-lg">
                Administra y supervisa todas tus cuentas financieras
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70" onClick={() => setModalOpen(true)}>
                <PlusCircle className="h-4 w-4 mr-2" />
                Nueva Cuenta
              </Button>
              <AccountFormModal
                open={modalOpen}
                setOpen={setModalOpen}
                createAccount={createAccount}
                isLoading={isLoading}
                error={error}
              />
              <AccountUpdateModal
                open={updateModalOpen}
                setOpen={setUpdateModalOpen}
                account={selectedAccount}
                updateAccount={updateAccount}
                isLoading={isLoading}
                error={error}
              />
            </div>
          </div>
        </div>

        {/* Resumen de cuentas */}
        <div className="mb-8">
          {Array.isArray(accounts) && accounts.length > 0 ? (
            <AccountSummaryCard accounts={accounts} />
          ) : (
            <div className="text-center text-muted-foreground py-8">No tienes cuentas registradas.</div>
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
      </motion.div>
    </div>
  );
}
