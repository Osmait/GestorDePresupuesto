"use client";
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Input } from '@/components/ui/input';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Edit, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Account } from '@/types/account';

const accountUpdateSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  bank: z.string().min(2, 'El banco debe tener al menos 2 caracteres'),
});
type AccountUpdateFormValues = z.infer<typeof accountUpdateSchema>;

type AccountUpdateModalProps = {
  open: boolean;
  setOpen: (v: boolean) => void;
  account: Account | null;
  updateAccount: (id: string, name: string, bank: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
};

export function AccountUpdateModal({ open, setOpen, account, updateAccount, isLoading, error }: AccountUpdateModalProps) {
  const [success, setSuccess] = useState(false);
  const form = useForm<AccountUpdateFormValues>({
    resolver: zodResolver(accountUpdateSchema),
    defaultValues: { 
      name: account?.name || '', 
      bank: account?.bank || '' 
    },
  });

  // Update form values when account changes
  React.useEffect(() => {
    if (account) {
      form.reset({
        name: account.name,
        bank: account.bank,
      });
    }
  }, [account, form]);

  async function onSubmit(values: AccountUpdateFormValues) {
    if (!account?.id) return;
    
    try {
      await updateAccount(account.id, values.name, values.bank);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setOpen(false);
      }, 1200);
    } catch (error) {
      console.error('Error updating account:', error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Cuenta</DialogTitle>
        </DialogHeader>
        {success ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
            <p className="text-green-600 font-semibold">¡Cuenta actualizada!</p>
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
              <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-md">
                <p><strong>Nota:</strong> Solo puedes editar el nombre y banco de la cuenta. El balance inicial no se puede modificar.</p>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isLoading} className="w-full">
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Edit className="h-4 w-4 mr-2" />}
                  Actualizar Cuenta
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