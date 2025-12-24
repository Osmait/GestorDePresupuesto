'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Wallet, DollarSign, TrendingUp, TrendingDown, CreditCard } from 'lucide-react';
import { Account } from '@/types/account';
import { AnimatedCounter } from '@/components/ui/animated-counter';
import { useTranslations } from 'next-intl';

export function AccountSummaryCard({ accounts }: { accounts: Account[] }) {
  const t = useTranslations('accounts');
  const totalCurrentBalance = (accounts ?? []).reduce((sum, account) => sum + (account.current_balance ?? account.initial_balance ?? 0), 0);
  const totalInitialBalance = (accounts ?? []).reduce((sum, account) => sum + (account.initial_balance ?? 0), 0);
  const positiveAccounts = (accounts ?? []).filter(account => (account.current_balance ?? account.initial_balance ?? 0) > 0);
  const negativeAccounts = (accounts ?? []).filter(account => (account.current_balance ?? account.initial_balance ?? 0) < 0);
  const balanceDifference = totalCurrentBalance - totalInitialBalance;

  return (
    <Card className="border-border/50 dark:border-border/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Wallet className="h-5 w-5" />
          {t('summary')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center p-4 rounded-lg bg-gradient-to-br from-blue-500/10 to-cyan-500/10 dark:from-blue-500/5 dark:to-cyan-500/5">
            <DollarSign className="h-6 w-6 mx-auto mb-2 text-blue-600 dark:text-blue-400" />
            <p className="text-sm font-medium text-muted-foreground">{t('currentBalance')}</p>
            <p className="text-2xl font-bold text-foreground">
              <AnimatedCounter value={totalCurrentBalance} prefix="$" decimals={2} />
            </p>
            {totalInitialBalance !== totalCurrentBalance && (
              <p className="text-xs text-muted-foreground mt-1">
                {t('initial')}: <AnimatedCounter value={totalInitialBalance} prefix="$" decimals={2} />
              </p>
            )}
          </div>
          <div className="text-center p-4 rounded-lg bg-gradient-to-br from-green-500/10 to-emerald-500/10 dark:from-green-500/5 dark:to-emerald-500/5">
            <TrendingUp className="h-6 w-6 mx-auto mb-2 text-green-600 dark:text-green-400" />
            <p className="text-sm font-medium text-muted-foreground">{t('positiveAccounts')}</p>
            <p className="text-2xl font-bold text-foreground">
              <AnimatedCounter value={positiveAccounts?.length ?? 0} />
            </p>
          </div>
          <div className="text-center p-4 rounded-lg bg-gradient-to-br from-orange-500/10 to-red-500/10 dark:from-orange-500/5 dark:to-red-500/5">
            <TrendingDown className="h-6 w-6 mx-auto mb-2 text-orange-600 dark:text-orange-400" />
            <p className="text-sm font-medium text-muted-foreground">{t('totalDifference')}</p>
            <p className={`text-2xl font-bold ${balanceDifference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {balanceDifference >= 0 ? '+' : ''}
              <AnimatedCounter value={Math.abs(balanceDifference)} prefix="$" decimals={2} />
            </p>
          </div>
          <div className="text-center p-4 rounded-lg bg-gradient-to-br from-purple-500/10 to-violet-500/10 dark:from-purple-500/5 dark:to-violet-500/5">
            <CreditCard className="h-6 w-6 mx-auto mb-2 text-purple-600 dark:text-purple-400" />
            <p className="text-sm font-medium text-muted-foreground">{t('totalAccounts')}</p>
            <p className="text-2xl font-bold text-foreground">
              <AnimatedCounter value={accounts?.length ?? 0} />
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}