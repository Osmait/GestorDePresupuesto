"use client";
import { useAccounts, useCategories, useTransactions, useBudgets } from '@/hooks/useRepositories';
import { useState, useEffect, useRef } from 'react';
import { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Filter, PlusCircle } from 'lucide-react';
import { CalendarDateRangePicker } from '@/components/date-range-picker';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose } from '@/components/ui/drawer';
import { AnimatedTabs } from '@/components/common/animated-tabs';
import TransactionItem from '@/components/transactions/TransactionItem';
import TransactionSummaryCard from '@/components/transactions/TransactionSummaryCard';
import TransactionFormModal from '@/components/transactions/TransactionFormModal';
import { Transaction, TypeTransaction } from '@/types/transaction';

export default function TransactionsClient() {
  const { transactions, isLoading: isLoadingTx, createTransaction, isLoading, error } = useTransactions();
  const { categories, isLoading: isLoadingCat } = useCategories();
  const { accounts, isLoading: isLoadingAcc } = useAccounts();
  const { budgets } = useBudgets();

  const incomeTransactions = transactions.filter(t => t.type_transation === TypeTransaction.INCOME);
  const expenseTransactions = transactions.filter(t => t.type_transation === TypeTransaction.BILL);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filters, setFilters] = useState({
    dateRange: { from: undefined, to: undefined } as DateRange,
    type: 'all',
    account: 'all',
    category: 'all',
    minAmount: '',
    maxAmount: '',
    search: '',
  });
  const [filtered, setFiltered] = useState<Transaction[] | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSuccess, setModalSuccess] = useState(false);
  const formRef = useRef<{ reset: () => void } | null>(null);

  function applyFilters() {
    let txs = transactions;
    if (filters.dateRange.from && filters.dateRange.to) {
      txs = txs.filter(tx => {
        const d = new Date(tx.created_at);
        return d >= filters.dateRange.from! && d <= filters.dateRange.to!;
      });
    }
    if (filters.type !== 'all') {
      txs = txs.filter(tx => (filters.type === 'INCOME' ? tx.type_transation === TypeTransaction.INCOME : tx.type_transation === TypeTransaction.BILL));
    }
    if (filters.account !== 'all') {
      txs = txs.filter(tx => tx.account_id === filters.account);
    }
    if (filters.category !== 'all') {
      txs = txs.filter(tx => tx.category_id === filters.category);
    }
    if (filters.minAmount) {
      txs = txs.filter(tx => tx.amount >= Number(filters.minAmount));
    }
    if (filters.maxAmount) {
      txs = txs.filter(tx => tx.amount <= Number(filters.maxAmount));
    }
    if (filters.search) {
      txs = txs.filter(tx => tx.description.toLowerCase().includes(filters.search.toLowerCase()));
    }
    setFiltered(txs);
  }

  function clearFilters() {
    setFilters({
      dateRange: { from: undefined, to: undefined },
      type: 'all',
      account: 'all',
      category: 'all',
      minAmount: '',
      maxAmount: '',
      search: '',
    });
    setFiltered(null);
  }

  const shownTransactions = filtered ? filtered : (Array.isArray(transactions) ? transactions.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) : []);

  useEffect(() => {
    applyFilters();
  }, [filters, transactions]);

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

        {/* Contenido principal con tabs */}
        <AnimatedTabs
          defaultValue="all"
          tabs={[
            {
              value: 'all',
              label: 'Todas',
              icon: <span className="inline-block"><svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M12 3v18m9-9H3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></span>,
              content: (
                <div className="space-y-4">
                  {Array.isArray(shownTransactions) ? shownTransactions.map((transaction) => {
                    const category = categories.find(c => c.id === transaction.category_id);
                    return (
                      <TransactionItem
                        key={transaction.id}
                        transaction={transaction}
                        category={category}
                      />
                    );
                  }) : []}
                </div>
              )
            },
            {
              value: 'income',
              label: 'Ingresos',
              icon: <span className="inline-block"><svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M12 3v18m9-9H3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></span>,
              content: (
                <div className="space-y-4">
                  {Array.isArray(incomeTransactions) ? incomeTransactions.map((transaction) => {
                    const category = categories.find(c => c.id === transaction.category_id);
                    return (
                      <TransactionItem
                        key={transaction.id}
                        transaction={transaction}
                        category={category}
                      />
                    );
                  }) : []}
                </div>
              )
            },
            {
              value: 'expense',
              label: 'Gastos',
              icon: <span className="inline-block"><svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M12 3v18m9-9H3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></span>,
              content: (
                <div className="space-y-4">
                  {Array.isArray(expenseTransactions) ? expenseTransactions.map((transaction) => {
                    const category = categories.find(c => c.id === transaction.category_id);
                    return (
                      <TransactionItem
                        key={transaction.id}
                        transaction={transaction}
                        category={category}
                      />
                    );
                  }) : []}
                </div>
              )
            },
          ]}
        />
      </div>
    </div>
  );
} 