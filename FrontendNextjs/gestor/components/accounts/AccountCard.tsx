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

interface AccountCardProps {
  account: Account;
  onAccountDeleted?: () => void;
  onAccountEdit?: (account: Account) => void;
}

export function AccountCard({ account, onAccountDeleted, onAccountEdit }: AccountCardProps) {
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
                Editar cuenta
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="flex items-center gap-2 cursor-pointer text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="h-4 w-4" />
                Eliminar cuenta
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Cuenta</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que quieres eliminar la cuenta "{account.name}"? 
              Esta acción no se puede deshacer y eliminará todos los datos asociados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteAccount}
              disabled={isDeleting}
            >
              {isDeleting ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
} 
