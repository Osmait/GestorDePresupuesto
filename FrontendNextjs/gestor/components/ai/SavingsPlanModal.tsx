'use client'

import { Loader2, PiggyBank } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useGetAccounts } from '@/hooks/queries/useAccountsQuery'
import {
	useCreateSavingsGoalMutation,
	useDeleteSavingsGoalMutation,
	useListSavingsGoalsMutation,
	useSavingsGoalProgressMutation,
	useSavingsPlanMutation,
} from '@/hooks/queries/useAIQuery'

interface SavingsPlanModalProps {
	open: boolean
	onOpenChange: (open: boolean) => void
}

export function SavingsPlanModal({ open, onOpenChange }: SavingsPlanModalProps) {
	const t = useTranslations('ai.savingsPlan')
	const tCommon = useTranslations('ai.common')
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

	const handleDeleteGoal = async (goalId: string) => {
		const response = await deleteGoal.mutateAsync(goalId)
		if ('success' in response && response.success) {
			toast.success(t('goalDeleted'))
			if (selectedGoalId === goalId) {
				setSelectedGoalId('')
			}
			await listGoals.mutateAsync()
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className='max-w-xl'>
				<DialogHeader>
					<DialogTitle className='flex items-center gap-2'>
						<PiggyBank className='h-5 w-5 text-primary' />
						{t('title')}
					</DialogTitle>
					<DialogDescription>{t('description')}</DialogDescription>
				</DialogHeader>

				<div className='space-y-4'>
					<div>
						<label className='text-sm font-medium mb-2 block'>{t('goalName')}</label>
						<Input
							type='text'
							value={goalName}
							onChange={(e) => setGoalName(e.target.value)}
							placeholder={t('goalNamePlaceholder')}
						/>
					</div>

					<div>
						<label className='text-sm font-medium mb-2 block'>{t('targetAmount')}</label>
						<Input
							type='number'
							value={targetAmount}
							onChange={(e) => setTargetAmount(e.target.value)}
							min={1}
							step={0.01}
							placeholder='10000'
						/>
					</div>

					<div>
						<label className='text-sm font-medium mb-2 block'>{t('currentSaved')}</label>
						<Input
							type='number'
							value={currentSaved}
							onChange={(e) => setCurrentSaved(e.target.value)}
							min={0}
							step={0.01}
							placeholder='0'
						/>
					</div>

					<div>
						<label className='text-sm font-medium mb-2 block'>{t('targetDate')}</label>
						<Input type='date' value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
					</div>

					<div>
						<label className='text-sm font-medium mb-2 block'>{t('accountOptional')}</label>
						<Select value={accountId || '__all__'} onValueChange={setAccountId}>
							<SelectTrigger>
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

					<div className='flex justify-end gap-2'>
						<Button variant='outline' onClick={() => onOpenChange(false)}>
							{tCommon('cancel')}
						</Button>
						<Button onClick={handleCreateGoal} disabled={createGoal.isPending} variant='outline'>
							{createGoal.isPending ? t('savingGoal') : t('saveGoal')}
						</Button>
						<Button onClick={handleCalculate} disabled={savingsPlan.isPending}>
							{savingsPlan.isPending ? (
								<>
									<Loader2 className='h-4 w-4 mr-2 animate-spin' />
									{t('calculating')}
								</>
							) : (
								t('calculate')
							)}
						</Button>
					</div>

					{result && (
						<div className='rounded-lg border p-4 space-y-2 text-sm'>
							<div>{t('monthly', { value: result.data.recommended_monthly_save.toFixed(2) })}</div>
							<div>{t('weekly', { value: result.data.recommended_weekly_save.toFixed(2) })}</div>
							<div>{t('months', { value: result.data.estimated_months_to_target })}</div>
							{result.data.target_date && <div>{result.data.feasible_by_date ? t('feasible') : t('notFeasible')}</div>}
						</div>
					)}

					<div className='rounded-lg border p-4 space-y-3'>
						<div className='text-sm font-medium'>{t('savedGoals')}</div>
						{goals.length === 0 && <div className='text-sm text-muted-foreground'>{t('noGoals')}</div>}
						{goals.map((goal) => (
							<div key={goal.id} className='rounded border p-3 space-y-2'>
								<div className='text-sm font-medium'>{goal.name}</div>
								<div className='text-xs text-muted-foreground'>
									{t('goalProgressInline', {
										saved: goal.current_saved.toFixed(2),
										target: goal.target_amount.toFixed(2),
										pct: goal.progress_pct.toFixed(1),
									})}
								</div>
								<div className='flex gap-2'>
									<Button size='sm' variant='outline' onClick={() => handleLoadProgress(goal.id)}>
										{t('viewProgress')}
									</Button>
									<Button size='sm' variant='ghost' onClick={() => handleDeleteGoal(goal.id)}>
										{t('deleteGoal')}
									</Button>
								</div>
							</div>
						))}
					</div>

					{progress && selectedGoalId && (
						<div className='rounded-lg border p-4 space-y-2 text-sm'>
							<div className='font-medium'>{progress.goal.name}</div>
							<div>{t('monthly', { value: progress.recommended_monthly_save.toFixed(2) })}</div>
							<div>{t('weekly', { value: progress.recommended_weekly_save.toFixed(2) })}</div>
							<div>{t('months', { value: progress.estimated_months_to_target })}</div>
							<div>{progress.feasible_by_date ? t('feasible') : t('notFeasible')}</div>
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	)
}
