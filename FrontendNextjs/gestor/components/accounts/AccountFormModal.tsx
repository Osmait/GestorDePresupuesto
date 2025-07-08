"use client";
import { useAccounts } from '@/hooks/useRepositories';
import { useAuth } from '@/hooks/useRepositories';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Input } from '@/components/ui/input';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, PlusCircle, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const accountSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  bank: z.string().min(2, 'El banco debe tener al menos 2 caracteres'),
  initial_balance: z.coerce.number().min(0, 'El balance debe ser mayor o igual a 0'),
});
type AccountFormValues = z.infer<typeof accountSchema>;

export function AccountFormModal({ open, setOpen }: { open: boolean, setOpen: (v: boolean) => void }) {
  const { createAccount, isLoading, error } = useAccounts();
  const { user } = useAuth();
  const [success, setSuccess] = useState(false);
  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: { name: '', bank: '', initial_balance: 0 },
  });

  async function onSubmit(values: AccountFormValues) {
    try {
      await createAccount(values.name, values.bank, values.initial_balance);
      setSuccess(true);
      form.reset();
      setTimeout(() => {
        setSuccess(false);
        setOpen(false);
      }, 1200);
    } catch {}
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva Cuenta</DialogTitle>
        </DialogHeader>
        {success ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
            <p className="text-green-600 font-semibold">¡Cuenta creada!</p>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre de la cuenta</FormLabel>
                  <FormControl><Input {...field} placeholder="Ej: Cuenta Principal" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="bank" render={({ field }) => (
                <FormItem>
                  <FormLabel>Banco</FormLabel>
                  <FormControl><Input {...field} placeholder="Ej: Banco Nacional" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="initial_balance" render={({ field }) => (
                <FormItem>
                  <FormLabel>Balance inicial</FormLabel>
                  <FormControl><Input type="number" {...field} min={0} step={0.01} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="submit" disabled={isLoading} className="w-full">
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PlusCircle className="h-4 w-4 mr-2" />}
                  Crear Cuenta
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