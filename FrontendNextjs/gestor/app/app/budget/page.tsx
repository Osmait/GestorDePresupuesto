'use client'

import { BudgetProvider } from '@/components/budgets/BudgetContext'
import { BudgetActions } from '@/components/budgets/BudgetActions'
import { BudgetList } from '@/components/budgets/BudgetList'
import { useTranslations } from 'next-intl'

export default function BudgetPage() {
	const t = useTranslations('budgets')
	return (
		<BudgetProvider>
			<div className="min-h-screen bg-background">
				<div className="container mx-auto px-4 py-8">
					<div className="mb-8" id="budgets-header">
						<div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
							<div>
								<h1 className="text-4xl font-bold tracking-tight text-foreground">
									{t('title')}
								</h1>
								<p className="text-muted-foreground mt-2 text-lg">
									{t('subtitle')}
								</p>
							</div>
							<div id="add-budget-btn">
								<BudgetActions />
							</div>
						</div>
					</div>

					<div id="budgets-list">
						<BudgetList />
					</div>
				</div>
			</div>
		</BudgetProvider>
	)
}

