'use client';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Input } from '@/components/ui/input';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, PlusCircle, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { format } from 'date-fns';
import { useAccounts, useCategories, useBudgets } from '@/hooks/useRepositories';
import {  TypeTransaction } from '@/types/transaction';

const transactionSchema = z.object({
  name: z.string().min(2, 'El nombre es requerido'),
  description: z.string().min(2, 'La descripción es requerida'),
  amount: z.coerce.number().min(0.01, 'El monto debe ser mayor a 0'),
  type_transaction: z.nativeEnum(TypeTransaction, { errorMap: () => ({ message: 'Selecciona un tipo' }) }),
  account_id: z.string().min(1, 'Selecciona una cuenta'),
  category_id: z.string().min(1, 'Selecciona una categoría'),
  budget_id: z.string().optional(),
  created_at: z.date(),
});
type TransactionFormValues = z.infer<typeof transactionSchema>;

type TransactionFormModalProps = {
  open: boolean;
  setOpen: (v: boolean) => void;
  createTransaction: (
    name: string,
    description: string,
    amount: number,
    type_transaction: TypeTransaction,
    account_id: string,
    category_id: string,
    budget_id?: string
  ) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  success: boolean;
  formRef: React.MutableRefObject<{ reset: () => void } | null>;
};

export default function TransactionFormModal({ open, setOpen, createTransaction, isLoading, error, success, formRef }: TransactionFormModalProps) {
  const { accounts } = useAccounts();
  const { categories } = useCategories();
  const { budgets } = useBudgets();
  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      name: '',
      description: '',
      amount: 0,
      type_transaction: TypeTransaction.BILL,
      account_id: '',
      category_id: '',
      budget_id: undefined,
      created_at: new Date(),
    },
  });

  useEffect(() => {
    formRef.current = { reset: form.reset };
  }, [form, formRef]);

  async function onSubmit(values: TransactionFormValues) {
    try {
      await createTransaction(
        values.name,
        values.description,
        values.amount,
        values.type_transaction,
        values.account_id,
        values.category_id,
        values.budget_id
      );
      form.reset();
    } catch {}
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva Transacción</DialogTitle>
        </DialogHeader>
        {success ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
            <p className="text-green-600 font-semibold">¡Transacción creada!</p>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl><Input {...field} placeholder="Ej: Pago de luz" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl><Input {...field} placeholder="Detalle de la transacción" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="amount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Monto</FormLabel>
                  <FormControl><Input type="number" {...field} min={0.01} step={0.01} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="type_transaction" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={v => {
                      field.onChange(v)}}>
                      <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={TypeTransaction.INCOME}>Ingreso</SelectItem>
                        <SelectItem value={TypeTransaction.BILL}>Gasto</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="account_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Cuenta</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                      <SelectContent>
                        {accounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="category_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoría</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                      <SelectContent>
                        {categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.icon} {cat.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="budget_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Presupuesto (opcional)</FormLabel>
                  <FormControl>
                    <Select value={field.value || 'none'} onValueChange={v => field.onChange(v === 'none' ? undefined : v)}>
                      <SelectTrigger><SelectValue placeholder="Sin presupuesto" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin presupuesto</SelectItem>
                        {budgets.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.category_id} - ${b.amount}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="created_at" render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha</FormLabel>
                  <FormControl>
                    <Input type="date" value={format(field.value, 'yyyy-MM-dd')} onChange={e => field.onChange(new Date(e.target.value))} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="submit" disabled={isLoading} className="w-full">
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PlusCircle className="h-4 w-4 mr-2" />}
                  Crear Transacción
                </Button>
                <DialogClose asChild>
                  <Button type="button" variant="ghost" className="w-full">Cancelar</Button>
                </DialogClose>
              </DialogFooter>
            </form>
          </Form>
        )}
        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </DialogContent>
    </Dialog>
  );
} 
