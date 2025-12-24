'use client';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Input } from '@/components/ui/input';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, PlusCircle, AlertCircle, CalendarIcon } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useGetAccounts } from '@/hooks/queries/useAccountsQuery';
import { useGetCategories } from '@/hooks/queries/useCategoriesQuery';
import { useGetBudgets } from '@/hooks/queries/useBudgetsQuery';
import { useTransactionContext } from './TransactionContext';
import { TypeTransaction } from '@/types/transaction';

const transactionSchema = z.object({
  name: z.string().min(2, 'El nombre es requerido'),
  description: z.string().optional(),
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
    budget_id?: string,
    created_at?: Date
  ) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  formRef: React.MutableRefObject<{ reset: () => void } | null>;
};

export default function TransactionFormModal({ open, setOpen, createTransaction, isLoading, error, formRef }: TransactionFormModalProps) {
  const { data: accounts = [] } = useGetAccounts();
  const { data: categories = [] } = useGetCategories();
  const { data: budgets = [] } = useGetBudgets();
  const { editingTransaction, updateTransaction } = useTransactionContext();

  const isEditing = !!editingTransaction;

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

  // Effect to populate form when editing
  useEffect(() => {
    if (editingTransaction) {
      form.reset({
        name: editingTransaction.name,
        description: editingTransaction.description,
        amount: Math.abs(editingTransaction.amount),
        type_transaction: editingTransaction.type_transation === 'income' ? TypeTransaction.INCOME : TypeTransaction.BILL,
        account_id: editingTransaction.account_id,
        category_id: editingTransaction.category_id,
        budget_id: editingTransaction.budget_id || undefined,
        created_at: new Date(editingTransaction.created_at || new Date()),
      });
    } else {
      form.reset({
        name: '',
        description: '',
        amount: 0,
        type_transaction: TypeTransaction.BILL,
        account_id: '',
        category_id: '',
        budget_id: undefined,
        created_at: new Date(),
      });
    }
  }, [editingTransaction, form]);


  async function onSubmit(values: TransactionFormValues) {
    try {
      if (isEditing) {
        await updateTransaction(
          editingTransaction.id,
          values.name,
          values.description,
          values.amount,
          values.type_transaction,
          values.account_id,
          values.category_id,
          values.budget_id,
          values.created_at
        );
      } else {
        await createTransaction(
          values.name,
          values.description || '', // Allow empty description
          values.amount,
          values.type_transaction,
          values.account_id,
          values.category_id,
          values.budget_id,
          values.created_at
        );
      }
      form.reset();
      setOpen(false);
    } catch { }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Transacción' : 'Nueva Transacción'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

            {/* Row 1: Nombre */}
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Ej: Pago de luz" autoFocus />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {/* Row 2: Monto y Tipo */}
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="amount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Monto</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                      <Input type="number" {...field} min={0.01} step={0.01} className="pl-7" />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="type_transaction" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={TypeTransaction.INCOME}>Ingreso</SelectItem>
                        <SelectItem value={TypeTransaction.BILL}>Gasto</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {/* Row 3: Cuenta y Categoría */}
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="account_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Cuenta</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona" />
                      </SelectTrigger>
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
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(cat => (
                          <SelectItem key={cat.id} value={cat.id}>
                            <span className="flex items-center gap-2">
                              {cat.icon} {cat.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {/* Row 4: Fecha y Presupuesto (Opcional) */}
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="created_at" render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP", { locale: es })
                          ) : (
                            <span>Seleccionar fecha</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) =>
                          date > new Date() || date < new Date("1900-01-01")
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Si quisieras agregar el campo de Presupuesto (budget_id), iría aquí.
                  Actualmente no lo veo explícito en el formulario original salvo en interfaces. 
                  Si no se usa, este espacio puede quedar vacío o extender la fecha.
                  Asumo que no se estaba mostrando antes (aunque estaba en props).
                  Si se debe mostrar, descomentar abajo. */}
              {/* <FormField control={form.control} name="budget_id" ... /> */}
            </div>

            {/* Row 5: Descripción */}
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Descripción</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Detalle de la transacción" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <DialogFooter className="pt-4">
              <DialogClose asChild>
                <Button type="button" variant="ghost">Cancelar</Button>
              </DialogClose>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PlusCircle className="h-4 w-4 mr-2" />}
                {isEditing ? 'Guardar Cambios' : 'Crear Transacción'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
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
