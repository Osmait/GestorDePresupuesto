import { BudgetProvider } from '@/components/budgets/BudgetContext'
import { BudgetActions } from '@/components/budgets/BudgetActions'
import { BudgetList } from '@/components/budgets/BudgetList'

export default function BudgetPage() {
	return (
		<BudgetProvider>
			<div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 dark:from-background dark:via-background dark:to-muted/20">
				<div className="container mx-auto px-4 py-8">
					{/* Header Estático - Server Side */}
					<div className="mb-8">
						<div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
							<div>
								<h1 className="text-4xl font-bold bg-gradient-to-r from-foreground via-primary to-primary bg-clip-text text-transparent">
									Gestión de Presupuestos
								</h1>
								<p className="text-muted-foreground mt-2 text-lg">
									Planifica y controla tus gastos por categoría
								</p>
							</div>
							{/* Acciones Interactivas - Client Side */}
							<BudgetActions />
						</div>
					</div>

					{/* Contenido Dinámico - Client Side */}
					<BudgetList />
				</div>
			</div>
		</BudgetProvider>
	)
}
