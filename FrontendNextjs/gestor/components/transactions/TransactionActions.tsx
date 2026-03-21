'use client'

import { Filter, Lightbulb, Link2, PiggyBank, PlusCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useRef, useState } from 'react'
import { AIExtractionButton, ReconciliationModal, SavingsPlanModal, SpendingInsightsModal } from '@/components/ai'
import { CalendarDateRangePicker } from '@/components/date-range-picker'
import TransactionFormModal from '@/components/transactions/TransactionFormModal'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useGetAccounts } from '@/hooks/queries/useAccountsQuery'
import { useGetCategories } from '@/hooks/queries/useCategoriesQuery'
import { useFeatureFlags } from '@/hooks/useFeatureFlags'
import { useTransactionContext } from './TransactionContext'

export function TransactionActions() {
	const t = useTranslations('transactions')
	const tForms = useTranslations('forms')
	const tAI = useTranslations('ai.common')
	const [drawerOpen, setDrawerOpen] = useState(false)
	const [insightsOpen, setInsightsOpen] = useState(false)
	const [reconciliationOpen, setReconciliationOpen] = useState(false)
	const [savingsPlanOpen, setSavingsPlanOpen] = useState(false)
	const formRef = useRef<{ reset: () => void } | null>(null)

	const {
		filters,
		setFilters,
		clearFilters,
		createTransaction,
		isLoading,
		error,
		isModalOpen,
		setModalOpen,
		setEditingTransaction,
	} = useTransactionContext()
	const { data: accounts = [] } = useGetAccounts()
	const { data: categories = [] } = useGetCategories()
	const { isEnabled } = useFeatureFlags()

	const canUseExtraction = isEnabled('ai_extraction')
	const canUseReconciliation = isEnabled('ai_reconciliation')
	const canUseSavingsPlan = isEnabled('ai_savings_plan')

	return (
		<div className='flex flex-wrap items-center gap-2 sm:gap-3'>
			{canUseExtraction && (
				<Button variant='outline' size='sm' className='sm:size-default' onClick={() => setInsightsOpen(true)}>
					<Lightbulb className='h-4 w-4 sm:mr-2' />
					<span className='hidden sm:inline'>{tAI('insights')}</span>
				</Button>
			)}
			{canUseExtraction && <AIExtractionButton variant='outline' size='sm' className='sm:size-default' />}
			{canUseReconciliation && (
				<Button variant='outline' size='sm' className='sm:size-default' onClick={() => setReconciliationOpen(true)}>
					<Link2 className='h-4 w-4 sm:mr-2' />
					<span className='hidden sm:inline'>{tAI('reconcile')}</span>
				</Button>
			)}
			{canUseSavingsPlan && (
				<Button variant='outline' size='sm' className='sm:size-default' onClick={() => setSavingsPlanOpen(true)}>
					<PiggyBank className='h-4 w-4 sm:mr-2' />
					<span className='hidden sm:inline'>{tAI('savingsPlan')}</span>
				</Button>
			)}
			<Button
				variant='outline'
				size='sm'
				className='sm:size-default border-border/50'
				onClick={() => setDrawerOpen(true)}
			>
				<Filter className='h-4 w-4 sm:mr-2' aria-hidden='true' />
				<span className='hidden sm:inline'>{t('filters')}</span>
			</Button>
			<Button
				size='sm'
				className='sm:size-default bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70'
				onClick={() => {
					setEditingTransaction(null)
					setModalOpen(true)
				}}
			>
				<PlusCircle className='h-4 w-4 sm:mr-2' aria-hidden='true' />
				<span className='hidden sm:inline'>{t('addTransaction')}</span>
			</Button>

			{canUseExtraction && <SpendingInsightsModal open={insightsOpen} onOpenChange={setInsightsOpen} />}
			{canUseReconciliation && <ReconciliationModal open={reconciliationOpen} onOpenChange={setReconciliationOpen} />}
			{canUseSavingsPlan && <SavingsPlanModal open={savingsPlanOpen} onOpenChange={setSavingsPlanOpen} />}

			<TransactionFormModal
				open={isModalOpen}
				setOpen={(open: boolean) => {
					setModalOpen(open)
					if (!open) {
						formRef.current?.reset()
					}
				}}
				createTransaction={async (...args) => {
					const [
						name,
						description,
						amount,
						type_transation,
						account_id,
						category_id,
						_budget_id,
						_currency,
						created_at_arg,
					] = args
					const created_at = created_at_arg ? new Date(created_at_arg).toISOString() : new Date().toISOString()

					const _optimisticTx = {
						id: `temp-${Date.now()}`,
						name,
						description,
						amount,
						type_transation,
						account_id,
						category_id,
						created_at,
						user_id: 'current-user',
						updated_at: new Date().toISOString(),
					}

					await createTransaction(...args)

					formRef.current?.reset()
				}}
				isLoading={isLoading}
				error={error}
			/>

			<Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
				<DrawerContent className='w-full max-w-sm ml-auto h-full'>
					<DrawerHeader>
						<DrawerTitle>{t('filterTransactions')}</DrawerTitle>
					</DrawerHeader>
					<div className='p-4 space-y-4 overflow-y-auto'>
						<CalendarDateRangePicker
							value={filters.dateRange}
							onChange={(dateRange) => {
								if (dateRange && typeof dateRange === 'object' && 'from' in dateRange && 'to' in dateRange) {
									setFilters((f) => ({ ...f, dateRange }))
								}
							}}
						/>
						<div>
							<label className='block mb-1 text-sm'>{tForms('type')}</label>
							<Select value={filters.type} onValueChange={(v) => setFilters((f) => ({ ...f, type: v }))}>
								<SelectTrigger>
									<SelectValue placeholder={t('all')} />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value='all'>{t('all')}</SelectItem>
									<SelectItem value='INCOME'>{t('income')}</SelectItem>
									<SelectItem value='BILL'>{t('expense')}</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div>
							<label className='block mb-1 text-sm'>{t('account')}</label>
							<Select value={filters.account} onValueChange={(v) => setFilters((f) => ({ ...f, account: v }))}>
								<SelectTrigger>
									<SelectValue placeholder={t('allFemale')} />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value='all'>{t('allFemale')}</SelectItem>
									{accounts.map((acc) => (
										<SelectItem key={acc.id} value={acc.id}>
											{acc.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div>
							<label className='block mb-1 text-sm'>{t('category')}</label>
							<Select value={filters.category} onValueChange={(v) => setFilters((f) => ({ ...f, category: v }))}>
								<SelectTrigger>
									<SelectValue placeholder={t('allFemale')} />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value='all'>{t('allFemale')}</SelectItem>
									{categories.map((cat) => (
										<SelectItem key={cat.id} value={cat.id}>
											{cat.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className='flex gap-2'>
							<div className='flex-1'>
								<label className='block mb-1 text-sm'>{t('minAmount')}</label>
								<Input
									type='number'
									value={filters.minAmount}
									onChange={(e) => setFilters((f) => ({ ...f, minAmount: e.target.value }))}
									placeholder='0'
									min={0}
								/>
							</div>
							<div className='flex-1'>
								<label className='block mb-1 text-sm'>{t('maxAmount')}</label>
								<Input
									type='number'
									value={filters.maxAmount}
									onChange={(e) => setFilters((f) => ({ ...f, maxAmount: e.target.value }))}
									placeholder='99999'
									min={0}
								/>
							</div>
						</div>
						<div>
							<label className='block mb-1 text-sm'>{t('search')}</label>
							<Input
								type='text'
								value={filters.search}
								onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
								placeholder={t('searchPlaceholder')}
							/>
						</div>
						<div className='flex flex-col gap-2 pt-4'>
							<Button type='button' variant='outline' onClick={() => clearFilters()}>
								{t('clearFilters')}
							</Button>
						</div>
					</div>
				</DrawerContent>
			</Drawer>
		</div>
	)
}
