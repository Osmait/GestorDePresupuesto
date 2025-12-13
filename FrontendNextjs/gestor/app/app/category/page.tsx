import { CategoryProvider } from '@/components/categories/CategoryContext'
import { CategoryActions } from '@/components/categories/CategoryActions'
import { CategoryList } from '@/components/categories/CategoryList'

export default function CategoriesPage() {
	return (
		<CategoryProvider>
			<div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 dark:from-background dark:via-background dark:to-muted/20">
				<div className="container mx-auto px-4 py-8">
					{/* Header Estático - Server Side */}
					<div className="mb-8">
						<div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
							<div>
								<h1 className="text-4xl font-bold bg-gradient-to-r from-foreground via-primary to-primary bg-clip-text text-transparent">
									Gestión de Categorías
								</h1>
								<p className="text-muted-foreground mt-2 text-lg">
									Organiza y clasifica tus transacciones financieras
								</p>
							</div>
							{/* Acciones Interactivas - Client Side */}
							<CategoryActions />
						</div>
					</div>

					{/* Contenido Dinámico - Client Side */}
					<CategoryList />
				</div>
			</div>
		</CategoryProvider>
	)
}
