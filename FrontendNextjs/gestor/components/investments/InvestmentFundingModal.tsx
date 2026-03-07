import { useEffect, useMemo, useState } from 'react'
import { Loader2, ArrowRightLeft } from 'lucide-react'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useGetAccounts } from '@/hooks/queries/useAccountsQuery'
import { useFundBrokerMutation, useGetInvestmentFundingBalances } from '@/hooks/queries/useInvestmentsQuery'

interface InvestmentFundingModalProps {
	isOpen: boolean
	onClose: () => void
}

const SUPPORTED_CURRENCIES = ['USD', 'DOP']

export function InvestmentFundingModal({ isOpen, onClose }: InvestmentFundingModalProps) {
	const { data: accounts = [] } = useGetAccounts()
	const { data: balances = [] } = useGetInvestmentFundingBalances()
	const fundMutation = useFundBrokerMutation()
	const [sourceAccountID, setSourceAccountID] = useState('')
	const [sourceAmount, setSourceAmount] = useState(0)
	const [targetCurrency, setTargetCurrency] = useState('USD')
	const [exchangeRate, setExchangeRate] = useState(0)
	const [feeAmount, setFeeAmount] = useState(0)
	const [notes, setNotes] = useState('')
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		if (!sourceAccountID && accounts.length > 0) {
			setSourceAccountID(accounts[0].id)
		}
	}, [accounts, sourceAccountID])

	useEffect(() => {
		if (isOpen) {
			setError(null)
		}
	}, [isOpen])

	const selectedAccount = useMemo(() => accounts.find((account) => account.id === sourceAccountID), [accounts, sourceAccountID])
	const sourceCurrency = selectedAccount?.currency || 'DOP'
	const requiresExchangeRate = sourceCurrency !== targetCurrency
	const estimatedTargetAmount = useMemo(() => {
		if (sourceAmount <= 0) return 0
		if (!requiresExchangeRate) return sourceAmount
		if (exchangeRate <= 0) return 0
		return sourceAmount / exchangeRate
	}, [sourceAmount, requiresExchangeRate, exchangeRate])

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault()
		setError(null)

		if (!sourceAccountID) {
			setError('Select a source account')
			return
		}
		if (sourceAmount <= 0) {
			setError('Source amount must be greater than 0')
			return
		}
		if (requiresExchangeRate && exchangeRate <= 0) {
			setError('Exchange rate is required when currencies differ')
			return
		}

		try {
			await fundMutation.mutateAsync({
				source_account_id: sourceAccountID,
				source_amount: sourceAmount,
				target_currency: targetCurrency,
				exchange_rate: requiresExchangeRate ? exchangeRate : undefined,
				fee_amount: feeAmount > 0 ? feeAmount : undefined,
				notes,
			})
			onClose()
		} catch (submitError: any) {
			setError(submitError?.message || 'Failed to fund broker balance')
		}
	}

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className='sm:max-w-[560px]'>
				<DialogHeader>
					<DialogTitle>Fund broker balance</DialogTitle>
					<DialogDescription>Move funds from a bank account into your investment wallet.</DialogDescription>
				</DialogHeader>

				<div className='rounded-md border p-3 text-sm'>
					<p className='font-medium'>Current wallet balances</p>
					<div className='mt-1 space-y-1 text-muted-foreground'>
						{balances.length === 0 && <p>No funding yet.</p>}
						{balances.map((balance) => (
							<p key={balance.currency}>{balance.currency}: {balance.available.toFixed(2)}</p>
						))}
					</div>
				</div>

				{error && (
					<Alert variant='destructive'>
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}

				<form onSubmit={handleSubmit} className='space-y-4'>
					<div className='space-y-1.5'>
						<Label htmlFor='source_account'>Source account</Label>
						<Select value={sourceAccountID} onValueChange={setSourceAccountID}>
							<SelectTrigger>
								<SelectValue placeholder='Select account' />
							</SelectTrigger>
							<SelectContent>
								{accounts.map((account) => (
									<SelectItem key={account.id} value={account.id}>
										{account.name} ({account.currency || 'DOP'})
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className='grid gap-3 md:grid-cols-2'>
						<div className='space-y-1.5'>
							<Label htmlFor='source_amount'>Amount from account ({sourceCurrency})</Label>
							<Input
								id='source_amount'
								type='number'
								step='any'
								value={sourceAmount}
								onChange={(event) => setSourceAmount(parseFloat(event.target.value || '0'))}
								required
							/>
						</div>
						<div className='space-y-1.5'>
							<Label htmlFor='target_currency'>Target wallet currency</Label>
							<Select value={targetCurrency} onValueChange={setTargetCurrency}>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{SUPPORTED_CURRENCIES.map((currency) => (
										<SelectItem key={currency} value={currency}>{currency}</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className='space-y-1.5'>
							<Label htmlFor='exchange_rate'>Exchange rate ({sourceCurrency} per {targetCurrency})</Label>
							<Input
								id='exchange_rate'
								type='number'
								step='any'
								value={exchangeRate}
								onChange={(event) => setExchangeRate(parseFloat(event.target.value || '0'))}
								disabled={!requiresExchangeRate}
								required={requiresExchangeRate}
							/>
						</div>
						<div className='space-y-1.5'>
							<Label htmlFor='fee_amount'>Bank/FX fees ({sourceCurrency})</Label>
							<Input
								id='fee_amount'
								type='number'
								step='any'
								value={feeAmount}
								onChange={(event) => setFeeAmount(parseFloat(event.target.value || '0'))}
							/>
						</div>
					</div>

					<div className='rounded-md border p-3 text-sm text-muted-foreground'>
						<p className='font-medium text-foreground'>Estimated credit</p>
						<div className='mt-1 flex items-center gap-2'>
							<span>{sourceAmount.toFixed(2)} {sourceCurrency}</span>
							<ArrowRightLeft className='h-4 w-4' />
							<span>{estimatedTargetAmount.toFixed(2)} {targetCurrency}</span>
						</div>
					</div>

					<div className='space-y-1.5'>
						<Label htmlFor='notes'>Notes (optional)</Label>
						<Input
							id='notes'
							value={notes}
							onChange={(event) => setNotes(event.target.value)}
							placeholder='Transfer to broker account'
						/>
					</div>

					<DialogFooter>
						<Button type='submit' disabled={fundMutation.isPending}>
							{fundMutation.isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
							Fund broker
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}
