import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Wallet, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { Transaction, TypeTransaction } from '@/types/transaction';
import { AnimatedFlashNumber } from '@/components/common/AnimatedFlashNumber';

export default function TransactionSummaryCard({ transactions }: { transactions: Transaction[] }) {
  const totalIncome = transactions.filter(t => t.type_transation === TypeTransaction.INCOME).reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = transactions.filter(t => t.type_transation === TypeTransaction.BILL).reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const totalTransactions = transactions.length;

  return (
    <Card className="border-border/50 dark:border-border/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Wallet className="h-5 w-5" />
          Resumen de Transacciones
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 rounded-lg bg-gradient-to-br from-green-500/10 to-emerald-500/10 dark:from-green-500/5 dark:to-emerald-500/5">
            <TrendingUp className="h-6 w-6 mx-auto mb-2 text-green-600 dark:text-green-400" />
            <p className="text-sm font-medium text-muted-foreground">Total Ingresos</p>
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
          </div>
          <div className="text-center p-4 rounded-lg bg-gradient-to-br from-red-500/10 to-rose-500/10 dark:from-red-500/5 dark:to-rose-500/5">
            <TrendingDown className="h-6 w-6 mx-auto mb-2 text-red-600 dark:text-red-400" />
            <p className="text-sm font-medium text-muted-foreground">Total Gastos</p>
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
          </div>
          <div className="text-center p-4 rounded-lg bg-gradient-to-br from-blue-500/10 to-cyan-500/10 dark:from-blue-500/5 dark:to-cyan-500/5">
            <DollarSign className="h-6 w-6 mx-auto mb-2 text-blue-600 dark:text-blue-400" />
            <p className="text-sm font-medium text-muted-foreground">Total Transacciones</p>
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