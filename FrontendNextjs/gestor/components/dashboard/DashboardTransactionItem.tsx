import { formatLocalDate } from '@/lib/i18n/date-locale'
import { getSignedAmount, isInflowTransaction } from '@/lib/transaction-utils'
import { formatCurrency } from '@/lib/utils'
import type { Category } from '@/types/category'
import type { Transaction } from '@/types/transaction'

/** One transaction row of the dashboard (overview card and transactions tab); renders on server and client. */
export function DashboardTransactionItem({
	transaction,
	category,
	locale,
}: {
	transaction: Transaction
	category?: Category
	locale?: string
}) {
	const isIncome = isInflowTransaction(transaction.type_transation)

	return (
		<div className='flex items-center justify-between gap-3 p-3 rounded-lg border border-border/40 dark:border-border/20 hover:bg-accent/50 dark:hover:bg-accent/50 transition-colors'>
			<div className='flex min-w-0 items-center gap-3'>
				<div
					className='w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-lg'
					style={{ backgroundColor: category?.color || '#6B7280' }}
				>
					{category?.icon || '💳'}
				</div>
				<div className='min-w-0'>
					<p className='font-medium text-foreground truncate'>{transaction.name}</p>
					<p className='text-sm text-muted-foreground truncate'>{transaction.description}</p>
					<p className='text-xs text-muted-foreground'>{formatLocalDate(transaction.created_at, locale ?? 'es')}</p>
				</div>
			</div>
			<div className='shrink-0 text-right'>
				<p
					className={`font-bold tabular-nums whitespace-nowrap ${isIncome ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
				>
					{formatCurrency(getSignedAmount(transaction), transaction.currency, {
						locale,
						signDisplay: 'exceptZero',
					})}
				</p>
				<p className='text-xs text-muted-foreground truncate max-w-[8rem]'>{category?.name}</p>
			</div>
		</div>
	)
}
