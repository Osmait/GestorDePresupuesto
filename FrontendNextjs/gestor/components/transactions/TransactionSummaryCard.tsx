'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Wallet, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { Transaction, TypeTransaction } from '@/types/transaction';
import { AnimatedFlashNumber } from '@/components/common/AnimatedFlashNumber';
import { useTranslations } from 'next-intl';
import { useExchangeRateQuery } from '@/hooks/queries/useExchangeRateQuery';

export default function TransactionSummaryCard({ transactions }: { transactions: Transaction[] }) {
  const t = useTranslations('transactions');
  const { data: exchangeRateData } = useExchangeRateQuery();
  const usdToDopRate = exchangeRateData?.usd_to_dop ?? 60;

  const incomeTotals = transactions
    .filter(tx => tx.type_transation === TypeTransaction.INCOME)
    .reduce((acc, tx) => {
      const amount = Math.abs(tx.amount)
      if ((tx.currency || 'DOP') === 'USD') {
        acc.usd += amount
      } else {
        acc.dop += amount
      }
      return acc
    }, { dop: 0, usd: 0 })

  const expenseTotals = transactions
    .filter(tx => tx.type_transation === TypeTransaction.BILL)
    .reduce((acc, tx) => {
      const amount = Math.abs(tx.amount)
      if ((tx.currency || 'DOP') === 'USD') {
        acc.usd += amount
      } else {
        acc.dop += amount
      }
      return acc
    }, { dop: 0, usd: 0 })

  const totalIncome = incomeTotals.dop + (incomeTotals.usd * usdToDopRate)
  const totalExpenses = expenseTotals.dop + (expenseTotals.usd * usdToDopRate)
  const totalTransactions = transactions.length;

  return (
    <Card className="border-border/50 dark:border-border/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Wallet className="h-5 w-5" />
          {t('summary')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 rounded-lg bg-gradient-to-br from-green-500/10 to-emerald-500/10 dark:from-green-500/5 dark:to-emerald-500/5">
            <TrendingUp className="h-6 w-6 mx-auto mb-2 text-green-600 dark:text-green-400" />
            <p className="text-sm font-medium text-muted-foreground">{t('totalIncome')}</p>
            <p className="text-2xl font-bold">
              <AnimatedFlashNumber
                value={totalIncome}
                className="text-green-600 dark:text-green-400"
                duration={1}
                separator=","
                prefix="$"
                preserveValue={true}
              />
            </p>
            <p className="text-xs text-muted-foreground">DOP: {incomeTotals.dop.toLocaleString('es-DO', { style: 'currency', currency: 'DOP' })}</p>
            <p className="text-xs text-muted-foreground">USD: {incomeTotals.usd.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</p>
          </div>
          <div className="text-center p-4 rounded-lg bg-gradient-to-br from-red-500/10 to-rose-500/10 dark:from-red-500/5 dark:to-rose-500/5">
            <TrendingDown className="h-6 w-6 mx-auto mb-2 text-red-600 dark:text-red-400" />
            <p className="text-sm font-medium text-muted-foreground">{t('totalExpenses')}</p>
            <p className="text-2xl font-bold">
              <AnimatedFlashNumber
                value={totalExpenses}
                className="text-red-600 dark:text-red-400"
                inverse={true}
                duration={1}
                separator=","
                prefix="$"
                preserveValue={true}
              />
            </p>
            <p className="text-xs text-muted-foreground">DOP: {expenseTotals.dop.toLocaleString('es-DO', { style: 'currency', currency: 'DOP' })}</p>
            <p className="text-xs text-muted-foreground">USD: {expenseTotals.usd.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</p>
          </div>
          <div className="text-center p-4 rounded-lg bg-gradient-to-br from-blue-500/10 to-cyan-500/10 dark:from-blue-500/5 dark:to-cyan-500/5">
            <DollarSign className="h-6 w-6 mx-auto mb-2 text-blue-600 dark:text-blue-400" />
            <p className="text-sm font-medium text-muted-foreground">{t('totalTransactions')}</p>
            <p className="text-2xl font-bold">
              <AnimatedFlashNumber
                value={totalTransactions}
                className="text-blue-600 dark:text-blue-400"
                duration={1}
                separator=","
                preserveValue={true}
              />
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
