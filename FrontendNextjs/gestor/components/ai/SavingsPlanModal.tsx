'use client'

import { Loader2, Target } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useId, useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { FormDialog } from '@/components/shared/FormDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useGetAccounts } from '@/hooks/queries/useAccountsQuery'
import {
	useCreateSavingsGoalMutation,
	useDeleteSavingsGoalMutation,
	useListSavingsGoalsMutation,
	useSavingsGoalProgressMutation,
	useSavingsPlanMutation,
} from '@/hooks/queries/useAIQuery'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { useFormatPercent } from '@/hooks/useFormatPercent'
import type { AISavingsGoal } from '@/types/ai'

interface SavingsPlanModalProps {
	open: boolean
	onOpenChange: (open: boolean) => void
}

export function SavingsPlanModal({ open, onOpenChange }: SavingsPlanModalProps) {
	const t = useTranslations('ai.savingsPlan')
	const tCommon = useTranslations('ai.common')
	const fieldId = useId()
	const formatCurrency = useFormatCurrency()
	const { data: accounts = [] } = useGetAccounts()
	const savingsPlan = useSavingsPlanMutation()
	const listGoals = useListSavingsGoalsMutation()
	const createGoal = useCreateSavingsGoalMutation()
	const deleteGoal = useDeleteSavingsGoalMutation()
	const goalProgress = useSavingsGoalProgressMutation()

	const [goalName, setGoalName] = useState('')
	const [targetAmount, setTargetAmount] = useState('')
	const [currentSaved, setCurrentSaved] = useState('0')
	const [targetDate, setTargetDate] = useState('')
	const [accountId, setAccountId] = useState('')
	const [selectedGoalId, setSelectedGoalId] = useState('')
	const [goalToDelete, setGoalToDelete] = useState<AISavingsGoal | null>(null)

	const currencyOf = (id?: string) => accounts.find((account) => account.id === id)?.currency
	const planCurrency = currencyOf(accountId && accountId !== '__all__' ? accountId : undefined)
	const formatPercent = useFormatPercent()

	const result = savingsPlan.data && 'success' in savingsPlan.data && savingsPlan.data.success ? savingsPlan.data : null
	const goals = listGoals.data && 'success' in listGoals.data && listGoals.data.success ? listGoals.data.data : []
	const progress =
		goalProgress.data && 'success' in goalProgress.data && goalProgress.data.success ? goalProgress.data.data : null

	useEffect(() => {
		if (!open) {
			return
		}
		void listGoals.mutateAsync()
	}, [open, listGoals.mutateAsync])

	const handleCalculate = async () => {
		const amount = Number(targetAmount)
		if (!Number.isFinite(amount) || amount <= 0) {
			toast.error(t('invalidAmount'))
			return
		}

		await savingsPlan.mutateAsync({
			target_amount: amount,
			target_date: targetDate || undefined,
			account_id: accountId && accountId !== '__all__' ? accountId : undefined,
		})
	}

	const handleCreateGoal = async () => {
		const amount = Number(targetAmount)
		const saved = Number(currentSaved)
		if (!goalName.trim()) {
			toast.error(t('invalidName'))
			return
		}
		if (!Number.isFinite(amount) || amount <= 0) {
			toast.error(t('invalidAmount'))
			return
		}

		const response = await createGoal.mutateAsync({
			name: goalName.trim(),
			target_amount: amount,
			target_date: targetDate || undefined,
			account_id: accountId && accountId !== '__all__' ? accountId : undefined,
			current_saved: Number.isFinite(saved) && saved >= 0 ? saved : 0,
		})

		if ('success' in response && response.success) {
			toast.success(t('goalCreated'))
			await listGoals.mutateAsync()
		}
	}

	const handleLoadProgress = async (goalId: string) => {
		setSelectedGoalId(goalId)
		await goalProgress.mutateAsync(goalId)
	}

	const handleDeleteGoal = async () => {
		if (!goalToDelete) return
		const goalId = goalToDelete.id
		const response = await deleteGoal.mutateAsync(goalId)
		if ('success' in response && response.success) {
			toast.success(t('goalDeleted'))
			if (selectedGoalId === goalId) {
				setSelectedGoalId('')
			}
			await listGoals.mutateAsync()
		}
	}

	const progressGoal = progress && selectedGoalId ? progress : null
	const progressCurrency = currencyOf(progressGoal?.goal.account_id)

	return (
		<>
			<FormDialog
				open={open}
				onOpenChange={onOpenChange}
				title={t('title')}
				description={t('description')}
				onSubmit={handleCalculate}
				submitLabel={t('calculate')}
				cancelLabel={tCommon('cancel')}
				footer={
					<>
						<Button type='button' variant='outline' className='sm:mr-auto' onClick={() => onOpenChange(false)}>
							{tCommon('cancel')}
						</Button>
						<Button
							type='button'
							variant='outline'
							onClick={handleCreateGoal}
							disabled={createGoal.isPending}
							aria-busy={createGoal.isPending || undefined}
						>
							{createGoal.isPending ? <Loader2 className='mr-2 h-4 w-4 animate-spin' aria-hidden='true' /> : null}
							{t('saveGoal')}
						</Button>
						<Button type='submit' disabled={savingsPlan.isPending} aria-busy={savingsPlan.isPending || undefined}>
							{savingsPlan.isPending ? <Loader2 className='mr-2 h-4 w-4 animate-spin' aria-hidden='true' /> : null}
							{t('calculate')}
						</Button>
					</>
				}
			>
				<div className='space-y-4'>
					<div className='space-y-2'>
						<Label htmlFor={`${fieldId}-name`}>{t('goalName')}</Label>
						<Input
							id={`${fieldId}-name`}
							type='text'
							value={goalName}
							onChange={(e) => setGoalName(e.target.value)}
							placeholder={t('goalNamePlaceholder')}
						/>
					</div>

					<div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
						<div className='space-y-2'>
							<Label htmlFor={`${fieldId}-target`}>{t('targetAmount')}</Label>
							<Input
								id={`${fieldId}-target`}
								type='number'
								inputMode='decimal'
								value={targetAmount}
								onChange={(e) => setTargetAmount(e.target.value)}
								min={1}
								step={0.01}
								placeholder='10000'
							/>
						</div>

						<div className='space-y-2'>
							<Label htmlFor={`${fieldId}-saved`}>{t('currentSaved')}</Label>
							<Input
								id={`${fieldId}-saved`}
								type='number'
								inputMode='decimal'
								value={currentSaved}
								onChange={(e) => setCurrentSaved(e.target.value)}
								min={0}
								step={0.01}
								placeholder='0'
							/>
						</div>

						<div className='space-y-2'>
							<Label htmlFor={`${fieldId}-date`}>{t('targetDate')}</Label>
							<Input
								id={`${fieldId}-date`}
								type='date'
								value={targetDate}
								onChange={(e) => setTargetDate(e.target.value)}
							/>
						</div>

						<div className='space-y-2'>
							<Label htmlFor={`${fieldId}-account`}>{t('accountOptional')}</Label>
							<Select value={accountId || '__all__'} onValueChange={setAccountId}>
								<SelectTrigger id={`${fieldId}-account`}>
									<SelectValue placeholder={t('allAccounts')} />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value='__all__'>{t('allAccounts')}</SelectItem>
									{accounts.map((account) => (
										<SelectItem key={account.id} value={account.id}>
											{account.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>

					{result && (
						<div role='status' className='space-y-1 rounded-lg border p-4 text-sm tabular-nums'>
							<p>{t('monthly', { value: formatCurrency(result.data.recommended_monthly_save, planCurrency) })}</p>
							<p>{t('weekly', { value: formatCurrency(result.data.recommended_weekly_save, planCurrency) })}</p>
							<p>{t('months', { value: result.data.estimated_months_to_target })}</p>
							{result.data.target_date && (
								<p className={result.data.feasible_by_date ? 'text-success' : 'text-warning'}>
									{result.data.feasible_by_date ? t('feasible') : t('notFeasible')}
								</p>
							)}
						</div>
					)}

					<section aria-labelledby={`${fieldId}-goals`} className='space-y-3'>
						<h3 id={`${fieldId}-goals`} className='text-sm font-semibold'>
							{t('savedGoals')}
						</h3>
						{goals.length === 0 && (
							<EmptyState
								compact
								icon={Target}
								title={t('noGoals')}
								description={t('noGoalsDescription')}
								className='rounded-lg border py-6'
							/>
						)}
						<ul className='space-y-3'>
							{goals.map((goal) => {
								const goalCurrency = currencyOf(goal.account_id)
								return (
									<li key={goal.id} className='space-y-2 rounded-lg border p-3'>
										<p className='text-sm font-medium'>{goal.name}</p>
										<Progress
											value={goal.progress_pct}
											tone={goal.progress_pct >= 100 ? 'success' : 'default'}
											aria-label={goal.name}
										/>
										<p className='text-xs text-muted-foreground tabular-nums'>
											{t('goalProgressInline', {
												saved: formatCurrency(goal.current_saved, goalCurrency),
												target: formatCurrency(goal.target_amount, goalCurrency),
												pct: formatPercent(goal.progress_pct),
											})}
										</p>
										<div className='flex flex-wrap gap-2'>
											<Button type='button' size='sm' variant='outline' onClick={() => handleLoadProgress(goal.id)}>
												{t('viewProgress')}
											</Button>
											<Button
												type='button'
												size='sm'
												variant='ghost'
												className='text-destructive hover:text-destructive'
												onClick={() => setGoalToDelete(goal)}
											>
												{t('deleteGoal')}
											</Button>
										</div>
									</li>
								)
							})}
						</ul>
					</section>

					{progressGoal && (
						<div role='status' className='space-y-1 rounded-lg border p-4 text-sm tabular-nums'>
							<p className='font-medium'>{progressGoal.goal.name}</p>
							<p>{t('monthly', { value: formatCurrency(progressGoal.recommended_monthly_save, progressCurrency) })}</p>
							<p>{t('weekly', { value: formatCurrency(progressGoal.recommended_weekly_save, progressCurrency) })}</p>
							<p>{t('months', { value: progressGoal.estimated_months_to_target })}</p>
							<p className={progressGoal.feasible_by_date ? 'text-success' : 'text-warning'}>
								{progressGoal.feasible_by_date ? t('feasible') : t('notFeasible')}
							</p>
						</div>
					)}
				</div>
			</FormDialog>

			<ConfirmDialog
				open={goalToDelete !== null}
				onOpenChange={(next) => !next && setGoalToDelete(null)}
				title={t('deleteGoalTitle', { name: goalToDelete?.name ?? '' })}
				description={t('deleteGoalDescription')}
				destructive
				onConfirm={handleDeleteGoal}
			/>
		</>
	)
}
