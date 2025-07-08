"use client";
import { useState } from 'react';
import { useAccounts } from '@/hooks/useRepositories';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Input } from '@/components/ui/input';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { useAuth } from '@/hooks/useRepositories';
import { AlertCircle, Loader2, PlusCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AnimatedTabs } from '@/components/common/animated-tabs';
import { Avatar, AvatarFallback} from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { AccountCard } from '@/components/accounts/AccountCard';
import { AccountSummaryCard } from '@/components/accounts/AccountSummaryCard';
import { AccountFormModal } from '@/components/accounts/AccountFormModal';
import { AccountSummarySkeleton } from '@/components/accounts/AccountSummarySkeleton';
import { AccountCardSkeleton } from '@/components/accounts/AccountCardSkeleton';
import { 
	CreditCard, 
	DollarSign, 
	PlusCircle as LucidePlusCircle, 
	Building, 
	TrendingUp,
	TrendingDown,
	Wallet,
	ArrowUpRight,
	ArrowDownRight,
	MoreHorizontal
} from 'lucide-react';

export default function AccountsClient() {
  const { accounts, isLoading } = useAccounts();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 dark:from-background dark:via-background dark:to-muted/20">
      <div className="container mx-auto px-4 py-8">
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
              <AccountFormModal open={modalOpen} setOpen={setModalOpen} />
            </div>
          </div>
        </div>

        {/* Resumen de cuentas */}
        <div className="mb-8">
          {isLoading ? (
            <AccountSummarySkeleton />
          ) : Array.isArray(accounts) && accounts.length > 0 ? (
            <AccountSummaryCard accounts={accounts} />
          ) : (
            <div className="text-center text-muted-foreground py-8">No tienes cuentas registradas.</div>
          )}
        </div>

        {/* Contenido principal con tabs animados */}
        <AnimatedTabs
          defaultValue="all"
          className="space-y-6"
          tabs={[
            {
              value: 'all',
              label: 'Todas',
              icon: <Wallet className="h-4 w-4" />, 
              content: isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[...Array(3)].map((_, i) => <AccountCardSkeleton key={i} />)}
                </div>
              ) : Array.isArray(accounts) && accounts.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {accounts.map((account) => (
                    <AccountCard key={account.id} account={account} />
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">No tienes cuentas registradas.</div>
              )
            },
            {
              value: 'positive',
              label: 'Positivas',
              icon: <TrendingUp className="h-4 w-4" />, 
              content: isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[...Array(2)].map((_, i) => <AccountCardSkeleton key={i} />)}
                </div>
              ) : Array.isArray(accounts) && accounts.filter(account => (account.current_balance ?? account.initial_balance ?? 0) > 0).length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {accounts.filter(account => (account.current_balance ?? account.initial_balance ?? 0) > 0).map((account) => (
                    <AccountCard key={account.id} account={account} />
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">No tienes cuentas positivas.</div>
              )
            },
            {
              value: 'negative',
              label: 'Negativas',
              icon: <TrendingDown className="h-4 w-4" />, 
              content: isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[...Array(1)].map((_, i) => <AccountCardSkeleton key={i} />)}
                </div>
              ) : Array.isArray(accounts) && accounts.filter(account => (account.current_balance ?? account.initial_balance ?? 0) < 0).length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {accounts.filter(account => (account.current_balance ?? account.initial_balance ?? 0) < 0).map((account) => (
                    <AccountCard key={account.id} account={account} />
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">No tienes cuentas negativas.</div>
              )
            },
          ]}
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
      </div>
    </div>
  );
} 