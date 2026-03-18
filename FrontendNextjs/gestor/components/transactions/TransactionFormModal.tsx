'use client';
import { useEffect, useRef, useState } from 'react';
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
import { es, enUS } from 'date-fns/locale';
import { useGetAccounts } from '@/hooks/queries/useAccountsQuery';
import { useGetCategories, useCreateCategoryMutation } from '@/hooks/queries/useCategoriesQuery';
import { useGetBudgets } from '@/hooks/queries/useBudgetsQuery';
import { useSuggestCategoryMutation } from '@/hooks/queries/useAIQuery';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { useTransactionContext } from './TransactionContext';
import { TypeTransaction } from '@/types/transaction';
import { useTranslations, useLocale } from 'next-intl';
import { getCreditCardRepository } from '@/lib/repositoryConfig';
import { AICategorySuggestion } from '@/types/ai';
import { toast } from 'sonner';

const transactionSchema = z.object({
  name: z.string().min(2, 'El nombre es requerido'),
  description: z.string().optional(),
  amount: z.coerce.number().min(0.01, 'El monto debe ser mayor a 0'),
  type_transaction: z.nativeEnum(TypeTransaction, { errorMap: () => ({ message: 'Selecciona un tipo' }) }),
  account_id: z.string().min(1, 'Selecciona una cuenta'),
  category_id: z.string().min(1, 'Selecciona una categoría'),
  budget_id: z.string().optional(),
  currency: z.string().length(3, 'Selecciona una moneda'),
  created_at: z.date(),
});
type TransactionFormValues = z.infer<typeof transactionSchema>;

type TransactionFormModalProps = {
  open: boolean;
  setOpen: (_v: boolean) => void;
  createTransaction: (
    _name: string,
    _description: string,
    _amount: number,
    _type_transaction: TypeTransaction,
    _account_id: string,
    _category_id: string,
    _budget_id?: string,
    _currency?: string,
    _created_at?: Date
  ) => Promise<void>;
  isLoading: boolean;
  error: string | null;
};

function ensureUniqueCategoryName(baseName: string, existingNames: string[]): string {
	const normalized = new Set(existingNames.map((name) => name.trim().toLowerCase()))
	const cleanBase = baseName.trim() || 'Nueva categoría'

	if (!normalized.has(cleanBase.toLowerCase())) {
		return cleanBase
	}

	let candidate = `${cleanBase} - IA`
	let index = 2
	while (normalized.has(candidate.toLowerCase())) {
		candidate = `${cleanBase} - IA ${index}`
		index++
	}

	return candidate
}

function isSameSuggestion(a: AICategorySuggestion | null, b: AICategorySuggestion | null) {
	if (!a || !b) {
		return false
	}

	return (
		a.category_id === b.category_id &&
		a.category_name === b.category_name &&
		a.new_category_name === b.new_category_name &&
		a.confidence === b.confidence &&
		Math.abs(a.score - b.score) < 0.0001 &&
		a.reason === b.reason
	)
}

const CURRENCIES = [
  { code: 'DOP', name: 'Peso Dominicano', symbol: 'RD$' },
  { code: 'USD', name: 'Dólar Estadounidense', symbol: 'US$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
];

export default function TransactionFormModal({ open, setOpen, createTransaction, isLoading, error }: TransactionFormModalProps) {
  const t = useTranslations('forms');
  const tTx = useTranslations('transactions');
  const locale = useLocale();
  const { data: accounts = [] } = useGetAccounts();
  const { data: categories = [], refetch: refetchCategories } = useGetCategories();
  useGetBudgets(); // Keep hook for cache but don't use data directly
  const { editingTransaction, updateTransaction } = useTransactionContext();
  const suggestCategoryMutation = useSuggestCategoryMutation()
  const createCategoryMutation = useCreateCategoryMutation()
  const { isEnabled, isLoading: isFeatureFlagsLoading } = useFeatureFlags()
  const suggestionRequestRef = useRef(0)
  const suggestCategoryFnRef = useRef(suggestCategoryMutation.mutateAsync)
  const lastSuggestionInputRef = useRef('')

  useEffect(() => {
		suggestCategoryFnRef.current = suggestCategoryMutation.mutateAsync
  }, [suggestCategoryMutation.mutateAsync])

  const isEditing = !!editingTransaction;
  const [cardCurrencies, setCardCurrencies] = useState<string[]>([])
  const [cardCurrenciesLoaded, setCardCurrenciesLoaded] = useState(false)
  const [categorySuggestion, setCategorySuggestion] = useState<AICategorySuggestion | null>(null)

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
      currency: 'DOP',
      created_at: new Date(),
    },
  });

  const selectedAccountId = form.watch('account_id')
  const typedName = form.watch('name')
  const typedDescription = form.watch('description')
  const typedAmount = form.watch('amount')
  const typedType = form.watch('type_transaction')
  const selectedCategoryId = form.watch('category_id')
  const isCategorySuggestionsEnabled = isEnabled('ai_category_suggestions')
  const selectedAccount = accounts.find((acc) => acc.id === selectedAccountId)
  const selectedAccountType = selectedAccount?.type || 'bank'
  const selectedAccountCurrency = selectedAccount?.currency || 'DOP'

  useEffect(() => {
    let cancelled = false

    async function loadCardCurrencies() {
      if (!selectedAccountId || selectedAccountType !== 'credit_card') {
        setCardCurrencies([])
        setCardCurrenciesLoaded(false)
        return
      }

      setCardCurrenciesLoaded(false)
      try {
        const repo = await getCreditCardRepository()
        const card = await repo.findById(selectedAccountId)
        const currencies = (card?.balances || []).map((b) => b.currency)

        if (cancelled) return

        setCardCurrencies(currencies)
        setCardCurrenciesLoaded(true)

        if (currencies.length > 0 && !currencies.includes(form.getValues('currency'))) {
          form.setValue('currency', currencies[0])
        }
      } catch {
        if (cancelled) return
        setCardCurrencies([])
        setCardCurrenciesLoaded(false)
      }
    }

    void loadCardCurrencies()
    return () => {
      cancelled = true
    }
  }, [selectedAccountId, selectedAccountType, form])

  // Effect to populate form when editing
  useEffect(() => {
    if (editingTransaction) {
      form.reset({
        name: editingTransaction.name,
        description: editingTransaction.description,
        amount: editingTransaction.amount,
        type_transaction: editingTransaction.type_transation === 'income' ? TypeTransaction.INCOME : TypeTransaction.BILL,
        account_id: editingTransaction.account_id,
        category_id: editingTransaction.category_id,
        budget_id: editingTransaction.budget_id || undefined,
        currency: editingTransaction.currency || 'DOP',
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
        currency: 'DOP',
        created_at: new Date(),
      });
    }
  }, [editingTransaction, form]);

  useEffect(() => {
	if (isEditing) {
		lastSuggestionInputRef.current = ''
		setCategorySuggestion(null)
		return
	}

	if (!isCategorySuggestionsEnabled) {
		lastSuggestionInputRef.current = ''
		setCategorySuggestion(null)
		return
	}

	if (isFeatureFlagsLoading) {
		return
	}

	if (!typedName || typedName.trim().length < 3 || !selectedAccountId || !typedAmount || typedAmount <= 0 || selectedCategoryId) {
		lastSuggestionInputRef.current = ''
		setCategorySuggestion(null)
		return
	}

	const timeout = setTimeout(async () => {
		const normalizedName = typedName.trim().toLowerCase()
		const normalizedDescription = (typedDescription || '').trim().toLowerCase()
		const numericAmount = Number(typedAmount)
		if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
			lastSuggestionInputRef.current = ''
			setCategorySuggestion(null)
			return
		}

		const currentInputSignature = [
			normalizedName,
			normalizedDescription,
			numericAmount.toFixed(2),
			typedType,
			selectedAccountId,
			(form.getValues('currency') || 'DOP').toUpperCase(),
		].join('|')

		if (currentInputSignature === lastSuggestionInputRef.current) {
			return
		}
		lastSuggestionInputRef.current = currentInputSignature

		const currentRequest = suggestionRequestRef.current + 1
		suggestionRequestRef.current = currentRequest

		const suggestionType = typedType === TypeTransaction.INCOME ? 'income' : 'bill'
		try {
			const result = await suggestCategoryFnRef.current({
				name: typedName,
				description: typedDescription || '',
				amount: numericAmount,
				type_transation: suggestionType,
				account_id: selectedAccountId,
				currency: form.getValues('currency') || 'DOP',
			})

			if (currentRequest !== suggestionRequestRef.current) {
				return
			}

			if ('success' in result && result.success && result.data) {
				const nextSuggestion = result.data
				setCategorySuggestion((prev) => (isSameSuggestion(prev, nextSuggestion) ? prev : nextSuggestion))
				return
			}

			lastSuggestionInputRef.current = ''
			setCategorySuggestion(null)
		} catch {
			if (currentRequest === suggestionRequestRef.current) {
				lastSuggestionInputRef.current = ''
				setCategorySuggestion(null)
			}
		}
	}, 450)

	return () => clearTimeout(timeout)
  }, [
	typedName,
	typedDescription,
	typedAmount,
	typedType,
	selectedAccountId,
	selectedCategoryId,
	isEditing,
	isFeatureFlagsLoading,
	isCategorySuggestionsEnabled,
	form,
  ])

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
          values.currency,
          values.created_at
        );
      } else {
        await createTransaction(
          values.name,
          values.description || '',
          values.amount,
          values.type_transaction,
          values.account_id,
          values.category_id,
          values.budget_id,
          values.currency,
          values.created_at
        );
      }
      form.reset();
      setOpen(false);
    } catch {
      // Error is handled via the error prop
    }
  }

  const applyCategorySuggestion = () => {
	if (!categorySuggestion) {
		return
	}
	form.setValue('category_id', categorySuggestion.category_id, { shouldValidate: true, shouldDirty: true })
	setCategorySuggestion(null)
  }

  const createCategoryFromSuggestion = async () => {
	if (!categorySuggestion) {
		return
	}

	const suggestedName = ensureUniqueCategoryName(
		categorySuggestion.new_category_name || categorySuggestion.category_name,
		categories.map((category) => category.name)
	)
	if (!suggestedName) {
		return
	}

	try {
		await createCategoryMutation.mutateAsync({
			name: suggestedName,
			icon: '📦',
			color: '#22c55e',
		})

		const refreshed = await refetchCategories()
		const createdCategory = (refreshed.data || []).find(
			(category) => category.name.toLowerCase() === suggestedName.toLowerCase()
		)

		if (createdCategory) {
			form.setValue('category_id', createdCategory.id, { shouldValidate: true, shouldDirty: true })
		}

		setCategorySuggestion(null)
		toast.success(t('categoryCreated', { name: suggestedName }))
	} catch {
		toast.error(t('failedToCreateCategory'))
	}
  }

  async function handleAccountChange(accountId: string, onChange: (_value: string) => void) {
    onChange(accountId)
    const selected = accounts.find(acc => acc.id === accountId)
    if (!selected || isEditing) {
      return
    }

    if ((selected.type || 'bank') === 'bank') {
      form.setValue('currency', selected.currency || 'DOP')
      return
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? t('editTransaction') : t('newTransaction')}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

            {/* Row 1: Nombre */}
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>{t('name')}</FormLabel>
                <FormControl>
                  <Input {...field} placeholder={t('namePlaceholder')} autoFocus />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {/* Row 2: Monto, Moneda y Tipo */}
            <div className="grid grid-cols-3 gap-4">
              <FormField control={form.control} name="amount" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('amount')}</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                      <Input type="number" {...field} min={0.01} step={0.01} className="pl-7" />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="currency" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('currency')}</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange} disabled={selectedAccountType === 'bank'}>
                      <SelectTrigger>
                        <SelectValue placeholder="DOP" />
                      </SelectTrigger>
                      <SelectContent>
                        {(selectedAccountType === 'credit_card' && cardCurrencies.length > 0
                          ? CURRENCIES.filter(c => cardCurrencies.includes(c.code))
                          : CURRENCIES).map(c => (
                          <SelectItem key={c.code} value={c.code}>
                            {c.code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  {selectedAccountType === 'bank' && selectedAccountId ? (
                    <p className="text-xs text-muted-foreground">
                      La moneda en cuentas bancarias es fija: {selectedAccountCurrency}
                    </p>
                  ) : null}
                  {selectedAccountType === 'credit_card' && selectedAccountId && cardCurrenciesLoaded && cardCurrencies.length === 0 ? (
                    <p className="text-xs text-destructive">
                      Esta tarjeta no tiene balances configurados para registrar transacciones.
                    </p>
                  ) : null}
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="type_transaction" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('type')}</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={(value) => {
                      void handleAccountChange(value, field.onChange)
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('select')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={TypeTransaction.INCOME}>{tTx('income')}</SelectItem>
                        <SelectItem value={TypeTransaction.BILL}>{tTx('expense')}</SelectItem>
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
                  <FormLabel>{t('account')}</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('select')} />
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
                  <FormLabel>{t('category')}</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('select')} />
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
					{categorySuggestion && (
						<div className='mt-2 flex items-center justify-between rounded-md border border-primary/30 bg-primary/5 px-2 py-1 text-xs'>
							<span>
								{t('aiSuggestionLabel', {
									name: categorySuggestion.category_name,
									confidence: t(`confidence.${categorySuggestion.confidence}`),
								})}
							</span>
							<Button type='button' variant='ghost' size='sm' onClick={applyCategorySuggestion}>
								{t('apply')}
							</Button>
							<Button
								type='button'
								variant='outline'
								size='sm'
								onClick={createCategoryFromSuggestion}
								disabled={createCategoryMutation.isPending}
								title={ensureUniqueCategoryName(
									categorySuggestion.new_category_name || categorySuggestion.category_name,
									categories.map((category) => category.name)
								)}
							>
								{t('createSuggestedCategory')}
							</Button>
						</div>
					)}
                </FormItem>
              )} />
            </div>

            {/* Row 4: Fecha y Presupuesto (Opcional) */}
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="created_at" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('date')}</FormLabel>
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
                            format(field.value, "PPP", { locale: locale === 'es' ? es : enUS })
                          ) : (
                            <span>{t('selectDate')}</span>
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
                <FormLabel>{t('description')}</FormLabel>
                <FormControl>
                  <Input {...field} placeholder={t('descriptionPlaceholder')} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <DialogFooter className="pt-4">
              <DialogClose asChild>
                <Button type="button" variant="ghost">{t('cancel')}</Button>
              </DialogClose>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PlusCircle className="h-4 w-4 mr-2" />}
                {isEditing ? t('saveChanges') : t('createTransaction')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error.includes('currency must match account currency')
                ? 'La moneda de la transacción debe coincidir con la moneda de la cuenta bancaria.'
                : error.includes('card does not have a balance in currency')
                  ? 'La tarjeta no tiene un balance disponible en esa moneda.'
                  : error}
            </AlertDescription>
          </Alert>
        )}
      </DialogContent>
    </Dialog>
  );
} 
