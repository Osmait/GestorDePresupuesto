"use client";
import { useAccounts, useCategories, useTransactions} from '@/hooks/useRepositories';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { DateRange } from 'react-day-picker';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Filter, PlusCircle, CreditCard, TrendingUp, TrendingDown } from 'lucide-react';
import { CalendarDateRangePicker } from '@/components/date-range-picker';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose } from '@/components/ui/drawer';
import { AnimatedTabs } from '@/components/common/animated-tabs';
import TransactionItem from '@/components/transactions/TransactionItem';
import TransactionSummaryCard from '@/components/transactions/TransactionSummaryCard';
import TransactionFormModal from '@/components/transactions/TransactionFormModal';
import { Transaction, TypeTransaction, TransactionFilters } from '@/types/transaction';

// Custom hook for debouncing values
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function TransactionsClient() {
  const { transactions, pagination, isLoading: isLoadingTx, loadTransactions, createTransaction, deleteTransaction, isLoading, error } = useTransactions();
  const { categories, isLoading: isLoadingCat } = useCategories();
  const { accounts, isLoading: isLoadingAcc } = useAccounts();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  console.log('Transactions Debug ', transactions)

  const incomeTransactions = transactions.filter(t => t.type_transation === TypeTransaction.INCOME);
  const expenseTransactions = transactions.filter(t => t.type_transation === TypeTransaction.BILL);

  const [drawerOpen, setDrawerOpen] = useState(false);
  
  // Initialize filters from URL parameters
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
  const [filtered, setFiltered] = useState<Transaction[] | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSuccess, setModalSuccess] = useState(false);
  const formRef = useRef<{ reset: () => void } | null>(null);

  // Debounce search input to avoid too many API calls
  const debouncedSearch = useDebounce(filters.search, 500);
  const debouncedMinAmount = useDebounce(filters.minAmount, 300);
  const debouncedMaxAmount = useDebounce(filters.maxAmount, 300);

  // Function to update URL with current filters
  const updateURLWithFilters = useCallback((newFilters: typeof filters) => {
    const params = new URLSearchParams();
    
    // Add filters to URL if they have values
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

    // Update URL
    const newURL = params.toString() ? `?${params.toString()}` : window.location.pathname;
    router.replace(newURL);
  }, [router]);

  // Function to apply filters automatically (used by useEffect hooks)
  const applyFiltersAutomatically = useCallback((currentFilters: typeof filters, searchText: string, minAmount: string, maxAmount: string) => {
    // Create a combined filters object with debounced values
    const combinedFilters = {
      ...currentFilters,
      search: searchText,
      minAmount: minAmount,
      maxAmount: maxAmount
    };

    // Update URL with current filters
    updateURLWithFilters(combinedFilters);
    
    const apiFilters: TransactionFilters = {
      page: 1,
      limit: 50,
      sort_by: 'created_at',
      sort_order: 'desc'
    };

    // Map UI filters to API filters
    if (combinedFilters.dateRange.from && combinedFilters.dateRange.to) {
      apiFilters.date_from = combinedFilters.dateRange.from.toISOString().split('T')[0];
      apiFilters.date_to = combinedFilters.dateRange.to.toISOString().split('T')[0];
    }
    
    if (combinedFilters.type !== 'all') {
      apiFilters.type = combinedFilters.type === 'INCOME' ? 'income' : 'expense';
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

    // Debug: log the filters being sent to API
    console.log('Applying filters to API:', apiFilters);
    
    // Load transactions with API filters
    loadTransactions(apiFilters);
    setFiltered(null); // Clear local filtered state since we're using API filtering
  }, [updateURLWithFilters, loadTransactions]);

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
    setFiltered(null);
    
    // Clear URL parameters
    router.replace(window.location.pathname);
    
    // Load all transactions without filters
    loadTransactions();
  }

  // Keep track of initial load to avoid applying filters during mount
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Effect to handle automatic filtering when filters change
  useEffect(() => {
    // Skip during initial load
    if (isInitialLoad) return;
    
    // Apply filters automatically when any filter changes
    applyFiltersAutomatically(filters, debouncedSearch, debouncedMinAmount, debouncedMaxAmount);
  }, [
    filters.dateRange.from, 
    filters.dateRange.to, 
    filters.type, 
    filters.account, 
    filters.category,
    debouncedSearch,
    debouncedMinAmount,
    debouncedMaxAmount,
    applyFiltersAutomatically,
    isInitialLoad
  ]);

  const shownTransactions = filtered ? filtered : (Array.isArray(transactions) ? transactions.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) : []);

  // Helper function to render transaction list
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

  // Tab configuration
  const tabsConfig = [
    {
      value: 'all',
      label: 'Todas',
      icon: <CreditCard className="h-4 w-4" />,
      transactionList: shownTransactions
    },
    {
      value: 'income',
      label: 'Ingresos',
      icon: <TrendingUp className="h-4 w-4" />,
      transactionList: incomeTransactions
    },
    {
      value: 'expense',
      label: 'Gastos',
      icon: <TrendingDown className="h-4 w-4" />,
      transactionList: expenseTransactions
    }
  ];

  // Apply filters on component mount if URL has parameters
  useEffect(() => {
    const hasActiveFilters = searchParams.toString().length > 0;
    if (hasActiveFilters) {
      // Manually trigger API call with URL filters on mount
      const apiFilters: TransactionFilters = {
        page: 1,
        limit: 50,
        sort_by: 'created_at',
        sort_order: 'desc'
      };

      // Map URL filters to API filters
      const dateFrom = searchParams.get('dateFrom');
      const dateTo = searchParams.get('dateTo');
      if (dateFrom && dateTo) {
        apiFilters.date_from = dateFrom;
        apiFilters.date_to = dateTo;
      }
      
      const type = searchParams.get('type');
      if (type && type !== 'all') {
        apiFilters.type = type === 'INCOME' ? 'income' : 'expense';
      }
      
      const account = searchParams.get('account');
      if (account && account !== 'all') {
        apiFilters.account_id = account;
      }
      
      const category = searchParams.get('category');
      if (category && category !== 'all') {
        apiFilters.category_id = category;
      }
      
      const minAmount = searchParams.get('minAmount');
      if (minAmount) {
        apiFilters.amount_min = Number(minAmount);
      }
      
      const maxAmount = searchParams.get('maxAmount');
      if (maxAmount) {
        apiFilters.amount_max = Number(maxAmount);
      }
      
      const search = searchParams.get('search');
      if (search) {
        apiFilters.search = search;
      }

      loadTransactions(apiFilters);
    }
    
    // Mark initial load as complete
    setIsInitialLoad(false);
  }, []); // Only run on mount

  useEffect(() => {
    if (modalSuccess) {
      const timeout = setTimeout(() => {
        setModalOpen(false);
        setModalSuccess(false);
        formRef.current?.reset();
      }, 1200);
      return () => clearTimeout(timeout);
    }
  }, [modalSuccess]);

  if (isLoadingTx || isLoadingCat || isLoadingAcc) {
    return <div className="flex justify-center items-center min-h-screen"><span className="text-lg">Cargando datos...</span></div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 dark:from-background dark:via-background dark:to-muted/20">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
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

        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} side="right">
          <DrawerContent side="right">
            <DrawerHeader>
              <DrawerTitle>Filtrar Transacciones</DrawerTitle>
            </DrawerHeader>
            <form className="p-4 space-y-4">
              <CalendarDateRangePicker value={filters.dateRange} onChange={dateRange => {
                if (dateRange && typeof dateRange === 'object' && 'from' in dateRange && 'to' in dateRange) {
                  setFilters(f => ({ ...f, dateRange }));
                }
              }} />
              <div>
                <label className="block mb-1">Tipo</label>
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
                <label className="block mb-1">Cuenta</label>
                <Select value={filters.account} onValueChange={v => setFilters(f => ({ ...f, account: v }))}>
                  <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {accounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block mb-1">Categoría</label>
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
                  <label className="block mb-1">Monto mínimo</label>
                  <Input type="number" value={filters.minAmount} onChange={e => setFilters(f => ({ ...f, minAmount: e.target.value }))} placeholder="0" min={0} />
                </div>
                <div className="flex-1">
                  <label className="block mb-1">Monto máximo</label>
                  <Input type="number" value={filters.maxAmount} onChange={e => setFilters(f => ({ ...f, maxAmount: e.target.value }))} placeholder="99999" min={0} />
                </div>
              </div>
              <div>
                <label className="block mb-1">Buscar</label>
                <Input type="text" value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} placeholder="Buscar por descripción..." />
              </div>
              <div className="flex gap-2 pt-4">
                <Button type="button" variant="outline" onClick={clearFilters} className="w-full">
                  Limpiar Filtros
                </Button>
              </div>
              <DrawerClose asChild>
                <Button type="button" variant="ghost" className="w-full">Cerrar</Button>
              </DrawerClose>
            </form>
          </DrawerContent>
        </Drawer>

        {/* Resumen de transacciones */}
        <div className="mb-8">
          <TransactionSummaryCard transactions={transactions} />
        </div>

        {/* Información de paginación */}
        {pagination && (
          <div className="mb-4 flex justify-between items-center text-sm text-muted-foreground">
            <span>
              Mostrando {transactions.length} de {pagination.total_records} transacciones
              {pagination.total_pages > 1 && ` (Página ${pagination.current_page} de ${pagination.total_pages})`}
            </span>
            {(filtered !== null || Object.values(filters).some(v => v && v !== 'all')) && (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Ver todas las transacciones
              </Button>
            )}
          </div>
        )}

        {/* Contenido principal con tabs */}
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
