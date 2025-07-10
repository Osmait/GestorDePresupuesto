import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { Calendar, ArrowUpRight, ArrowDownRight, MoreHorizontal, Trash2, Edit } from 'lucide-react';
import { Transaction, TypeTransaction } from '@/types/transaction';
import { Category } from '@/types/category';
import { useState } from 'react';

interface TransactionItemProps {
  transaction: Transaction;
  category?: Category;
  onTransactionDeleted?: () => void;
}

export default function TransactionItem({ transaction, category, onTransactionDeleted }: TransactionItemProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const isIncome = transaction.type_transation === TypeTransaction.INCOME;

  const handleDeleteTransaction = async () => {
    if (!transaction.id || !onTransactionDeleted) return;
    
    setIsDeleting(true);
    try {
      await onTransactionDeleted();
      setShowDeleteDialog(false);
    } catch (error) {
      console.error('Error deleting transaction:', error);
    } finally {
      setIsDeleting(false);
    }
  };
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
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className={`font-bold text-xl ${isIncome ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {isIncome ? '+' : '-'}${transaction.amount.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">USD</p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="flex items-center gap-2 cursor-pointer">
                  <Edit className="h-4 w-4" />
                  Editar transacción
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="flex items-center gap-2 cursor-pointer text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="h-4 w-4" />
                  Eliminar transacción
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Transacción</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que quieres eliminar la transacción "{transaction.description}"? 
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
              onClick={handleDeleteTransaction}
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