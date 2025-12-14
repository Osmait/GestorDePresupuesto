import { TransactionProvider } from '@/components/transactions/TransactionContext'
import { TransactionActions } from '@/components/transactions/TransactionActions'
import TransactionsList from '@/components/transactions/TransactionsList'

export default function TransactionsPage() {
	return (
		<div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 dark:from-background dark:via-background dark:to-muted/20">
			<div className="container mx-auto px-4 py-8">
				<TransactionProvider>
					{/* Header Estático - Server Side */}
					<div className="mb-8">
						<div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
							<div>
								<h1 className="text-4xl font-bold tracking-tight text-foreground">
									Gestión de Transacciones
								</h1>
								<p className="text-muted-foreground mt-2 text-lg">
									Supervisa y analiza todas tus transacciones financieras
								</p>
							</div>
							{/* Acciones */}
							<TransactionActions />
						</div>
					</div>

					{/* Contenido Dinámico */}
					<TransactionsList />
				</TransactionProvider>
			</div>
		</div>
	)
}
