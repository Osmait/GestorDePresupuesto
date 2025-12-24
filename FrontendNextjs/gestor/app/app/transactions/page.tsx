import { TransactionProvider } from '@/components/transactions/TransactionContext'
import { TransactionActions } from '@/components/transactions/TransactionActions'
import TransactionsList from '@/components/transactions/TransactionsList'
import { RecurringTransactionProvider } from '@/components/recurring/RecurringTransactionContext'
import { RecurringTransactionList } from '@/components/recurring/RecurringTransactionList'
import { RecurringTransactionActions } from '@/components/recurring/RecurringTransactionActions'
import { RecurringTransactionFormModal } from '@/components/recurring/RecurringTransactionFormModal'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function TransactionsPage() {
	return (
		<div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 dark:from-background dark:via-background dark:to-muted/20">
			<div className="container mx-auto px-4 py-8">
				<div className="mb-8" id="transactions-header">
					<h1 className="text-4xl font-bold tracking-tight text-foreground">
						Gestión de Transacciones
					</h1>
					<p className="text-muted-foreground mt-2 text-lg">
						Supervisa y analiza todas tus transacciones financieras
					</p>
				</div>

				<Tabs defaultValue="history" className="space-y-4" id="transactions-tabs">
					<TabsList>
						<TabsTrigger value="history">Historial</TabsTrigger>
						<TabsTrigger value="recurring">Recurrentes</TabsTrigger>
					</TabsList>

					<TabsContent value="history" className="space-y-4">
						<TransactionProvider>
							<div className="flex justify-end mb-4" id="add-transaction-btn">
								<TransactionActions />
							</div>
							<div id="transactions-list">
								<TransactionsList />
							</div>
						</TransactionProvider>
					</TabsContent>

					<TabsContent value="recurring" className="space-y-4">
						<RecurringTransactionProvider>
							<RecurringTransactionActions />
							<RecurringTransactionList />
							<RecurringTransactionFormModal />
						</RecurringTransactionProvider>
					</TabsContent>
				</Tabs>
			</div>
		</div>
	)
}
