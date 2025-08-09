"use client";
import { useAccounts, useCategories, useTransactions } from '@/hooks/useRepositories';
import { useState, useEffect, useRef, useCallback} from 'react';
import { DateRange } from 'react-day-picker';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Filter, PlusCircle, CreditCard, TrendingUp, TrendingDown } from 'lucide-react';
import { CalendarDateRangePicker } from '@/components/date-range-picker';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'; // <--- CAMBIO: DrawerClose ya no es necesario aquí
import { AnimatedTabs } from '@/components/common/animated-tabs';
import TransactionItem from '@/components/transactions/TransactionItem';
import TransactionSummaryCard from '@/components/transactions/TransactionSummaryCard';
import TransactionFormModal from '@/components/transactions/TransactionFormModal';
import { Transaction, TypeTransaction, TransactionFilters } from '@/types/transaction';


export default function TransactionsClient() {
  const { transactions, pagination, isLoading: isLoadingTx, loadTransactions, createTransaction, deleteTransaction, isLoading, error } = useTransactions();
  const { categories, isLoading: isLoadingCat } = useCategories();
  const { accounts, isLoading: isLoadingAcc } = useAccounts();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const incomeTransactions = transactions.filter(t => t.type_transation === TypeTransaction.INCOME);
  const expenseTransactions = transactions.filter(t => t.type_transation === TypeTransaction.BILL);

  const [drawerOpen, setDrawerOpen] = useState(false);
  
  const initializeFiltersFromURL = useCallback(() => {
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    
    return {
      dateRange: {
        from: dateFrom ? new Date(dateFrom) : undefined,
        to: dateTo ? new Date(dateTo) : undefined,
      } as DateRange,
      type: searchParams.get('type') || 'all',
      account: searchParams.get('account') || 'all',
      category: searchParams.get('category') || 'all',
      minAmount: searchParams.get('minAmount') || '',
      maxAmount: searchParams.get('maxAmount') || '',
      search: searchParams.get('search') || '',
    };
  }, [searchParams]);

  const [filters, setFilters] = useState(() => initializeFiltersFromURL());
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSuccess, setModalSuccess] = useState(false);
  const formRef = useRef<{ reset: () => void } | null>(null);


  const updateURLWithFilters = useCallback((newFilters: typeof filters) => {
    const params = new URLSearchParams();
    
    if (newFilters.dateRange.from) {
      params.set('dateFrom', newFilters.dateRange.from.toISOString().split('T')[0]);
    }
    if (newFilters.dateRange.to) {
      params.set('dateTo', newFilters.dateRange.to.toISOString().split('T')[0]);
    }
    if (newFilters.type && newFilters.type !== 'all') {
      params.set('type', newFilters.type);
    }
    if (newFilters.account && newFilters.account !== 'all') {
      params.set('account', newFilters.account);
    }
    if (newFilters.category && newFilters.category !== 'all') {
      params.set('category', newFilters.category);
    }
    if (newFilters.minAmount) {
      params.set('minAmount', newFilters.minAmount);
    }
    if (newFilters.maxAmount) {
      params.set('maxAmount', newFilters.maxAmount);
    }
    if (newFilters.search) {
      params.set('search', newFilters.search);
    }

    const newURL = params.toString() ? `?${params.toString()}` : window.location.pathname;
    router.replace(newURL);
  }, [router]);

  const applyFiltersAndFetch = useCallback((currentFilters: typeof filters) => {
    const combinedFilters = {
      ...currentFilters
    };

    updateURLWithFilters(combinedFilters);
    
    const apiFilters: TransactionFilters = {
      page: 1,
      limit: 50,
      sort_by: 'created_at',
      sort_order: 'desc'
    };

    if (combinedFilters.dateRange.from && combinedFilters.dateRange.to) {
      apiFilters.date_from = combinedFilters.dateRange.from.toISOString().split('T')[0];
      apiFilters.date_to = combinedFilters.dateRange.to.toISOString().split('T')[0];
    }
    if (combinedFilters.type !== 'all') {
      apiFilters.type = combinedFilters.type === 'INCOME' ? 'income' : 'bill';
    }
    if (combinedFilters.account !== 'all') {
      apiFilters.account_id = combinedFilters.account;
    }
    if (combinedFilters.category !== 'all') {
      apiFilters.category_id = combinedFilters.category;
    }
    if (combinedFilters.minAmount) {
      apiFilters.amount_min = Number(combinedFilters.minAmount);
    }
    if (combinedFilters.maxAmount) {
      apiFilters.amount_max = Number(combinedFilters.maxAmount);
    }
    if (combinedFilters.search) {
      apiFilters.search = combinedFilters.search;
    }
    
    loadTransactions(apiFilters);
  }, [updateURLWithFilters, loadTransactions]);

  // <--- CAMBIO: Nueva función para manejar el click del botón
  const handleApplyFilters = () => {
    applyFiltersAndFetch(filters);
    setDrawerOpen(false);
  };

  function clearFilters() {
    const clearedFilters = {
      dateRange: { from: undefined, to: undefined },
      type: 'all',
      account: 'all',
      category: 'all',
      minAmount: '',
      maxAmount: '',
      search: '',
    };
    
    setFilters(clearedFilters);
    router.replace(window.location.pathname);
    loadTransactions();
    setDrawerOpen(false); 
  }


  const shownTransactions = Array.isArray(transactions) ? transactions.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) : [];

  const renderTransactionList = (transactionList: Transaction[]) => (
    <div className="space-y-4">
      {transactionList.map((transaction) => {
        const category = categories.find(c => c.id === transaction.category_id);
        return (
          <TransactionItem
            key={transaction.id}
            transaction={transaction}
            category={category}
            onTransactionDeleted={() => deleteTransaction(transaction.id!)}
          />
        );
      })}
    </div>
  );

  const tabsConfig = [
    { value: 'all', label: 'Todas', icon: <CreditCard className="h-4 w-4" />, transactionList: shownTransactions },
    { value: 'income', label: 'Ingresos', icon: <TrendingUp className="h-4 w-4" />, transactionList: incomeTransactions },
    { value: 'expense', label: 'Gastos', icon: <TrendingDown className="h-4 w-4" />, transactionList: expenseTransactions }
  ];

  useEffect(() => {
    const hasActiveFilters = searchParams.toString().length > 0;
    if (hasActiveFilters) {
      const initialFilters = initializeFiltersFromURL();
      applyFiltersAndFetch(initialFilters);
    }
  }, []); // <--- CAMBIO: Lógica de carga inicial simplificada. Solo se ejecuta una vez.

  useEffect(() => {
    if (modalSuccess) { 
        setModalOpen(false);
        setModalSuccess(false);
        formRef.current?.reset(); 
    }
  }, [modalSuccess]);

  if (isLoadingTx || isLoadingCat || isLoadingAcc) {
    return <div className="flex justify-center items-center min-h-screen"><span className="text-lg">Cargando datos...</span></div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 dark:from-background dark:via-background dark:to-muted/20">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-foreground via-primary to-primary bg-clip-text text-transparent">
                Gestión de Transacciones
              </h1>
              <p className="text-muted-foreground mt-2 text-lg">
                Supervisa y analiza todas tus transacciones financieras
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" className="border-border/50" onClick={() => setDrawerOpen(true)}>
                <Filter className="h-4 w-4 mr-2" />
                Filtrar
              </Button>
              <Button className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70" onClick={() => setModalOpen(true)}>
                <PlusCircle className="h-4 w-4 mr-2" />
                Nueva Transacción
              </Button>
              <TransactionFormModal
                open={modalOpen}
                setOpen={(open: boolean) => {
                  setModalOpen(open);
                  if (!open) {
                    setModalSuccess(false);
                    formRef.current?.reset();
                  }
                }}
                createTransaction={async (...args) => {
                  // @ts-ignore
                  await createTransaction(...args);
                  setModalSuccess(true);
                }}
                isLoading={isLoading}
                error={error}
                success={modalSuccess}
                formRef={formRef}
              />
            </div>
          </div>
        </div>

        {/* --- SECCIÓN DEL DRAWER MODIFICADA --- */}
        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} >
          <DrawerContent className="w-full max-w-sm ml-auto h-full">
            <DrawerHeader>
              <DrawerTitle>Filtrar Transacciones</DrawerTitle>
            </DrawerHeader>
            <div className="p-4 space-y-4 overflow-y-auto">
              <CalendarDateRangePicker value={filters.dateRange} onChange={dateRange => {
                if (dateRange && typeof dateRange === 'object' && 'from' in dateRange && 'to' in dateRange) {
                  setFilters(f => ({ ...f, dateRange }));
                }
              }} />
              <div>
                <label className="block mb-1 text-sm">Tipo</label>
                <Select value={filters.type} onValueChange={v => setFilters(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="INCOME">Ingreso</SelectItem>
                    <SelectItem value="BILL">Gasto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block mb-1 text-sm">Cuenta</label>
                <Select value={filters.account} onValueChange={v => setFilters(f => ({ ...f, account: v }))}>
                  <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {accounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block mb-1 text-sm">Categoría</label>
                <Select value={filters.category} onValueChange={v => setFilters(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block mb-1 text-sm">Monto mínimo</label>
                  <Input type="number" value={filters.minAmount} onChange={e => setFilters(f => ({ ...f, minAmount: e.target.value }))} placeholder="0" min={0} />
                </div>
                <div className="flex-1">
                  <label className="block mb-1 text-sm">Monto máximo</label>
                  <Input type="number" value={filters.maxAmount} onChange={e => setFilters(f => ({ ...f, maxAmount: e.target.value }))} placeholder="99999" min={0} />
                </div>
              </div>
              <div>
                <label className="block mb-1 text-sm">Buscar</label>
                <Input type="text" value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} placeholder="Buscar por descripción..." />
              </div>
              {/* <--- CAMBIO: Botones de acción en el drawer */}
              <div className="flex flex-col gap-2 pt-4">
                <Button type="button" onClick={handleApplyFilters}>
                  Aplicar Filtros
                </Button>
                <Button type="button" variant="outline" onClick={clearFilters}>
                  Limpiar Filtros
                </Button>
              </div>
            </div>
          </DrawerContent>
        </Drawer>
        
        <div className="mb-8">
          <TransactionSummaryCard transactions={transactions} />
        </div>

        {pagination && (
          <div className="mb-4 flex justify-between items-center text-sm text-muted-foreground">
            <span>
              Mostrando {transactions.length} de {pagination.total_records} transacciones
              {pagination.total_pages > 1 && ` (Página ${pagination.current_page} de ${pagination.total_pages})`}
            </span>
            {(searchParams.toString().length > 0) && (
              <Button variant="link" size="sm" onClick={clearFilters}>
                Ver todas las transacciones
              </Button>
            )}
          </div>
        )}

        <AnimatedTabs
          defaultValue="all"
          tabs={tabsConfig.map(tab => ({
            value: tab.value,
            label: tab.label,
            icon: tab.icon,
            content: renderTransactionList(tab.transactionList)
          }))}
        />
      </div>
    </div>
  );
}
