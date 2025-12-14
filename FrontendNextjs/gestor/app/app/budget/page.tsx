import { BudgetProvider } from '@/components/budgets/BudgetContext'
import { BudgetActions } from '@/components/budgets/BudgetActions'
import { BudgetList } from '@/components/budgets/BudgetList'

export default function BudgetPage() {
	return (
		<BudgetProvider>
			<div className="min-h-screen bg-background">
				<div className="container mx-auto px-4 py-8">
					{/* Header Estático - Server Side */}
					<div className="mb-8">
						<div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
							<div>
								<h1 className="text-4xl font-bold tracking-tight text-foreground">
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
