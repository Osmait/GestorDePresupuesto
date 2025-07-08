import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Transaction, TypeTransaction } from '@/types/transaction';
import { Category } from '@/types/category';

interface TransactionItemProps {
  transaction: Transaction;
  category?: Category;
}

export default function TransactionItem({ transaction, category }: TransactionItemProps) {
  const isIncome = transaction.type_transation === TypeTransaction.INCOME;
  return (
    <Card className="hover:shadow-md hover:shadow-primary/5 dark:hover:shadow-primary/10 transition-all duration-300 border-border/50 dark:border-border/20">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className={`p-3 rounded-full ${isIncome ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
              {isIncome ? (
                <ArrowUpRight className="h-5 w-5 text-green-600 dark:text-green-400" />
              ) : (
                <ArrowDownRight className="h-5 w-5 text-red-600 dark:text-red-400" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-semibold text-foreground">{transaction.description}</p>
                {category && (
                  <Badge variant="outline" className="text-xs border-muted-foreground/30 bg-muted/30 dark:bg-muted/20">
                    {category.icon} {category.name}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(transaction.created_at).toLocaleDateString('es-ES', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className={`font-bold text-xl ${isIncome ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {isIncome ? '+' : '-'}${transaction.amount.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">USD</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 