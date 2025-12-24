"use client";
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Building, ArrowUpRight, ArrowDownRight, MoreHorizontal, Trash2, Edit } from 'lucide-react';
import { Account } from '@/types/account';
import { useState } from 'react';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { formatCurrency } from '@/lib/utils';

interface AccountCardProps {
  account: Account;
  onAccountDeleted?: () => void;
  onAccountEdit?: (_account: Account) => void;
}

export function AccountCard({ account, onAccountDeleted, onAccountEdit }: AccountCardProps) {
  const t = useTranslations('accounts');
  const tForms = useTranslations('forms');
  const router = useRouter();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const currentBalance = account.current_balance ?? account.initial_balance ?? 0;
  const initialBalance = account.initial_balance ?? 0;
  const isPositive = currentBalance > 0;
  const hasGrowth = currentBalance > initialBalance;

  const handleDeleteAccount = async () => {
    if (!account.id || !onAccountDeleted) return;

    setIsDeleting(true);
    try {
      await onAccountDeleted();
      setShowDeleteDialog(false);
    } catch (error) {
      console.error('Error deleting account:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Prevent navigation if clicking on dropdown or interactive elements
    if ((e.target as HTMLElement).closest('[role="menuitem"], button')) {
      return
    }
    router.push(`/app/accounts/${account.id}`)
  }

  return (
    <Card
      className="hover:bg-accent/40 dark:hover:bg-accent/40 transition-all duration-300 border-border/50 dark:border-border/20 cursor-pointer"
      onClick={handleCardClick}
    >
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="flex items-center gap-2 cursor-pointer"
                onClick={() => onAccountEdit?.(account)}
              >
                <Edit className="h-4 w-4" />
                {t('edit')}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="flex items-center gap-2 cursor-pointer text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="h-4 w-4" />
                {t('delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">{t('currentBalance')}</span>
            <div className="flex items-center gap-2">
              {isPositive ? (
                <ArrowUpRight className="h-4 w-4 text-green-600 dark:text-green-400" />
              ) : (
                <ArrowDownRight className="h-4 w-4 text-red-600 dark:text-red-400" />
              )}
              <span className={`font-bold text-2xl ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {formatCurrency(currentBalance)}
              </span>
            </div>
          </div>
          {initialBalance !== currentBalance && (
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">{t('initial')}: {formatCurrency(initialBalance)}</span>
              <span className={`font-medium ${hasGrowth ? 'text-green-600' : 'text-red-600'}`}>
                {hasGrowth ? '+' : ''}{formatCurrency(currentBalance - initialBalance).replace('$', '')}
              </span>
            </div>
          )}
          <div className="flex justify-between items-center pt-2 border-t border-border/50">
            <span className="text-xs text-muted-foreground">USD</span>
            <Badge variant="outline" className="bg-muted/30 dark:bg-muted/20">
              {currentBalance > 10000 ? t('high') : currentBalance > 5000 ? t('medium') : t('low')}
            </Badge>
          </div>
        </div>
      </CardContent>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteTitle')}</DialogTitle>
            <DialogDescription>
              {t('deleteDescription', { name: account.name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              {tForms('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={isDeleting}
            >
              {isDeleting ? t('deleting') : tForms('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
} 
