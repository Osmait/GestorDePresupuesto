"use client";
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
import { useTranslations } from 'next-intl';

const accountSchema = z.object({
  name: z.string().min(2, 'Required'),
  bank: z.string().min(2, 'Required'),
  initial_balance: z.coerce.number().min(0, 'Required'),
});
type AccountFormValues = z.infer<typeof accountSchema>;

type AccountFormModalProps = {
  open: boolean;
  setOpen: (v: boolean) => void;
  createAccount: (name: string, bank: string, initial_balance: number) => Promise<void>;
  isLoading: boolean;
  error: string | null;
};

export function AccountFormModal({ open, setOpen, createAccount, isLoading, error }: AccountFormModalProps) {
  const { user } = useAuth();
  const t = useTranslations('forms');
  const tAcc = useTranslations('accounts');
  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: { name: '', bank: '', initial_balance: 0 },
  });

  async function onSubmit(values: AccountFormValues) {
    try {
      await createAccount(values.name, values.bank, values.initial_balance);
      form.reset();
    } catch { }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('newAccount')}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>{tAcc('name')}</FormLabel>
                <FormControl><Input {...field} placeholder={tAcc('namePlaceholder')} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="bank" render={({ field }) => (
              <FormItem>
                <FormLabel>{t('bank')}</FormLabel>
                <FormControl><Input {...field} placeholder={tAcc('bankPlaceholder')} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="initial_balance" render={({ field }) => (
              <FormItem>
                <FormLabel>{t('initialBalance')}</FormLabel>
                <FormControl><Input type="number" {...field} min={0} step={0.01} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <DialogFooter>
              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PlusCircle className="h-4 w-4 mr-2" />}
                {t('createAccount')}
              </Button>
              <DialogClose asChild>
                <Button type="button" variant="ghost" className="w-full">{t('cancel')}</Button>
              </DialogClose>
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
