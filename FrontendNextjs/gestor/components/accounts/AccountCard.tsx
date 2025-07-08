"use client";
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Building, ArrowUpRight, ArrowDownRight, MoreHorizontal } from 'lucide-react';
import { Account } from '@/types/account';

interface AccountCardProps {
  account: Account;
}

export function AccountCard({ account }: AccountCardProps) {
  const currentBalance = account.current_balance ?? account.initial_balance ?? 0;
  const initialBalance = account.initial_balance ?? 0;
  const isPositive = currentBalance > 0;
  const hasGrowth = currentBalance > initialBalance;

  return (
    <Card className="hover:shadow-lg hover:shadow-primary/5 dark:hover:shadow-primary/10 transition-all duration-300 border-border/50 dark:border-border/20">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <Avatar className="h-14 w-14 border-2 border-primary/20">
              <AvatarFallback className="bg-gradient-to-br from-primary/80 to-primary text-primary-foreground font-semibold text-lg">
                {(account.name ?? '').charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-foreground text-lg">{account.name}</p>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Building className="h-4 w-4" />
                {account.bank}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Balance Actual</span>
            <div className="flex items-center gap-2">
              {isPositive ? (
                <ArrowUpRight className="h-4 w-4 text-green-600 dark:text-green-400" />
              ) : (
                <ArrowDownRight className="h-4 w-4 text-red-600 dark:text-red-400" />
              )}
              <span className={`font-bold text-2xl ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                ${currentBalance.toLocaleString()}
              </span>
            </div>
          </div>
          {initialBalance !== currentBalance && (
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Saldo inicial: ${initialBalance.toLocaleString()}</span>
              <span className={`font-medium ${hasGrowth ? 'text-green-600' : 'text-red-600'}`}>
                {hasGrowth ? '+' : ''}{(currentBalance - initialBalance).toLocaleString()}
              </span>
            </div>
          )}
          <div className="flex justify-between items-center pt-2 border-t border-border/50">
            <span className="text-xs text-muted-foreground">USD</span>
            <Badge variant="outline" className="bg-muted/30 dark:bg-muted/20">
              {currentBalance > 10000 ? 'Alto' : currentBalance > 5000 ? 'Medio' : 'Bajo'}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 