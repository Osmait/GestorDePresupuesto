import { BudgetCardSkeleton } from './BudgetCardSkeleton'
import { BudgetSummarySkeleton } from './BudgetSummarySkeleton'

/** Mirrors BudgetList: KPI row and card grid. */
export function BudgetsPageSkeleton() {
	return (
		<div className='space-y-6' aria-busy='true'>
			<BudgetSummarySkeleton />
			<div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
				{['sk-1', 'sk-2', 'sk-3', 'sk-4', 'sk-5', 'sk-6'].map((key) => (
					<BudgetCardSkeleton key={key} />
				))}
			</div>
		</div>
	)
}
