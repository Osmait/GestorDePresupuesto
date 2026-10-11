import { Amount } from '@/components/shared/Amount'
import { formatLocalDate } from '@/lib/i18n/date-locale'
import { getSignedAmount } from '@/lib/transaction-utils'
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
	return (
		<div className='flex items-center justify-between gap-3 rounded-lg border p-3'>
			<div className='flex min-w-0 items-center gap-3'>
				{/* Category color and emoji are user data; uncategorized rows use the muted fill. */}
				<div
					className='flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-lg'
					style={category?.color ? { backgroundColor: category.color } : undefined}
					aria-hidden='true'
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
				{/* Signed amount: income/inflows positive, expenses negative. */}
				<Amount
					value={getSignedAmount(transaction)}
					currency={transaction.currency}
					tone='auto'
					signed
					className='font-semibold'
				/>
				<p className='text-xs text-muted-foreground truncate max-w-[8rem]'>{category?.name}</p>
			</div>
		</div>
	)
}
