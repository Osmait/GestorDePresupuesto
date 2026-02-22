import { useEffect, useMemo, useState } from 'react'
import { Loader2, AlertCircle, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
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
import { useCreateInvestmentMutation, useGetInvestmentFundingBalances, useUpdateInvestmentMutation } from '@/hooks/queries/useInvestmentsQuery'
import { investmentRepository } from '@/lib/repositoryConfig'
import { CreateInvestmentDTO, Investment, InvestmentType } from '@/types/investment'

interface InvestmentFormModalProps {
	isOpen: boolean
	onClose: () => void
	investmentToEdit?: Investment | null
}

const initialData: CreateInvestmentDTO = {
	name: '',
	symbol: '',
	type: InvestmentType.STOCK,
	quantity: 0,
	purchase_price: 0,
	current_price: 0,
	settlement_currency: 'USD',
}

export function InvestmentFormModal({ isOpen, onClose, investmentToEdit }: InvestmentFormModalProps) {
	const [formData, setFormData] = useState<CreateInvestmentDTO>(initialData)
	const [error, setError] = useState<string | null>(null)
	const [fetchLoading, setFetchLoading] = useState(false)
	const createMutation = useCreateInvestmentMutation()
	const updateMutation = useUpdateInvestmentMutation()
	const { data: balances = [] } = useGetInvestmentFundingBalances()

	useEffect(() => {
		setError(null)
		if (investmentToEdit) {
			setFormData({
				name: investmentToEdit.name,
				symbol: investmentToEdit.symbol,
				type: investmentToEdit.type,
				quantity: investmentToEdit.quantity,
				purchase_price: investmentToEdit.purchase_price,
				current_price: investmentToEdit.current_price,
				settlement_currency: investmentToEdit.settlement_currency || 'USD',
			})
			return
		}
		setFormData(initialData)
	}, [investmentToEdit, isOpen])

	const settlementCurrency = (formData.settlement_currency || 'USD').toUpperCase()
	const requiredAmount = Math.max(formData.quantity, 0) * Math.max(formData.purchase_price, 0)
	const availableBalance = useMemo(() => {
		const match = balances.find((balance) => balance.currency === settlementCurrency)
		return match?.available || 0
	}, [balances, settlementCurrency])

	const handleFetchPrice = async () => {
		if (!formData.symbol) return
		setFetchLoading(true)
		try {
			const quote = await investmentRepository.getQuote(formData.symbol)
			if (quote) {
				setFormData((prev) => ({
					...prev,
					current_price: quote.regular_market_price,
					name: (!prev.name || prev.name === '') && quote.name ? quote.name : prev.name,
					purchase_price: prev.purchase_price === 0 ? quote.regular_market_price : prev.purchase_price,
				}))
				setError(null)
				return
			}
			setError('Could not fetch price for this symbol')
		} catch {
			setError('Failed to fetch price')
		} finally {
			setFetchLoading(false)
		}
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setError(null)

		if (!investmentToEdit && requiredAmount > availableBalance) {
			setError(`Insufficient broker balance in ${settlementCurrency}. Required: ${requiredAmount.toFixed(2)}, available: ${availableBalance.toFixed(2)}`)
			return
		}

		try {
			if (investmentToEdit) {
				await updateMutation.mutateAsync({
					id: investmentToEdit.id,
					...formData,
				})
			} else {
				await createMutation.mutateAsync(formData)
			}
			onClose()
		} catch (submitError: any) {
			const errorMessage = submitError?.message || 'Failed to save investment. Please try again.'
			setError(errorMessage)
		}
	}

	const isLoading = createMutation.isPending || updateMutation.isPending

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-[560px]'>
				<DialogHeader>
					<DialogTitle>{investmentToEdit ? 'Edit investment' : 'Add investment'}</DialogTitle>
					<DialogDescription>
						{investmentToEdit
							? 'Update the details of your investment.'
							: 'Use your broker funding balance to add a new investment.'}
					</DialogDescription>
				</DialogHeader>

				{error && (
					<Alert variant='destructive'>
						<AlertCircle className='h-4 w-4' />
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}

				<form onSubmit={handleSubmit} className='space-y-4'>
					<div className='rounded-md border p-3 text-sm'>
						<p className='font-medium'>Broker balance</p>
						<p className='text-muted-foreground'>
							{settlementCurrency}: {availableBalance.toFixed(2)}
						</p>
						<p className='text-muted-foreground'>
							Required for this purchase: {requiredAmount.toFixed(2)}
						</p>
					</div>

					<div className='space-y-1.5'>
						<Label htmlFor='name'>Name</Label>
						<Input
							id='name'
							value={formData.name}
							onChange={(event) => setFormData({ ...formData, name: event.target.value })}
							required
						/>
					</div>

					<div className='space-y-1.5'>
						<Label htmlFor='symbol'>Symbol</Label>
						<div className='flex gap-2'>
							<Input
								id='symbol'
								value={formData.symbol}
								onChange={(event) => setFormData({ ...formData, symbol: event.target.value.toUpperCase() })}
								placeholder='e.g. AAPL, BTC-USD'
								required
							/>
							<Button type='button' size='icon' variant='outline' onClick={handleFetchPrice} disabled={fetchLoading || !formData.symbol}>
								{fetchLoading ? <Loader2 className='h-4 w-4 animate-spin' /> : <Search className='h-4 w-4' />}
							</Button>
						</div>
					</div>

					<div className='grid gap-3 md:grid-cols-2'>
						<div className='space-y-1.5'>
							<Label htmlFor='type'>Type</Label>
							<Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value as InvestmentType })}>
								<SelectTrigger>
									<SelectValue placeholder='Select type' />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={InvestmentType.STOCK}>Stock</SelectItem>
									<SelectItem value={InvestmentType.CRYPTO}>Crypto</SelectItem>
									<SelectItem value={InvestmentType.FIXED_INCOME}>Fixed income</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div className='space-y-1.5'>
							<Label htmlFor='settlement_currency'>Purchase currency</Label>
							<Input
								id='settlement_currency'
								value={settlementCurrency}
								onChange={(event) => setFormData({ ...formData, settlement_currency: event.target.value.toUpperCase() })}
								maxLength={10}
							/>
						</div>
						<div className='space-y-1.5'>
							<Label htmlFor='quantity'>Quantity</Label>
							<Input
								id='quantity'
								type='number'
								step='any'
								value={formData.quantity}
								onChange={(event) => setFormData({ ...formData, quantity: parseFloat(event.target.value || '0') })}
								required
							/>
						</div>
						<div className='space-y-1.5'>
							<Label htmlFor='purchase_price'>Purchase price</Label>
							<Input
								id='purchase_price'
								type='number'
								step='any'
								value={formData.purchase_price}
								onChange={(event) => setFormData({ ...formData, purchase_price: parseFloat(event.target.value || '0') })}
								required
							/>
						</div>
						<div className='space-y-1.5 md:col-span-2'>
							<Label htmlFor='current_price'>Current price</Label>
							<Input
								id='current_price'
								type='number'
								step='any'
								value={formData.current_price}
								onChange={(event) => setFormData({ ...formData, current_price: parseFloat(event.target.value || '0') })}
								required
							/>
						</div>
					</div>

					<DialogFooter>
						<Button type='submit' disabled={isLoading}>
							{isLoading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
							{investmentToEdit ? 'Update' : 'Create'}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}
