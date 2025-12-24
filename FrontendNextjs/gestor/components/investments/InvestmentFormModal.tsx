import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { InvestmentType, CreateInvestmentDTO, Investment } from "@/types/investment"
import { useEffect, useState } from "react"
import { useCreateInvestmentMutation, useUpdateInvestmentMutation } from "@/hooks/queries/useInvestmentsQuery"
import { Loader2, AlertCircle, Search } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { investmentRepository } from "@/lib/repositoryConfig"

interface InvestmentFormModalProps {
    isOpen: boolean
    onClose: () => void
    investmentToEdit?: Investment | null
}

const initialData: CreateInvestmentDTO = {
    name: "",
    symbol: "",
    type: InvestmentType.STOCK,
    quantity: 0,
    purchase_price: 0,
    current_price: 0,
}

export function InvestmentFormModal({ isOpen, onClose, investmentToEdit }: InvestmentFormModalProps) {
    const [formData, setFormData] = useState<CreateInvestmentDTO>(initialData)
    const [error, setError] = useState<string | null>(null)
    const [fetchLoading, setFetchLoading] = useState(false)
    const createMutation = useCreateInvestmentMutation()
    const updateMutation = useUpdateInvestmentMutation()

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
            })
        } else {
            setFormData(initialData)
        }
    }, [investmentToEdit, isOpen])

    const handleFetchPrice = async () => {
        if (!formData.symbol) return
        setFetchLoading(true)
        try {
            const quote = await investmentRepository.getQuote(formData.symbol)
            if (quote) {
                setFormData(prev => ({
                    ...prev,
                    current_price: quote.regular_market_price,
                    // Auto-fill name if fetching for a new investment or if name is empty
                    name: (!prev.name || prev.name === "") && quote.name ? quote.name : prev.name,
                    // If purchase price is 0, auto-fill it too (assuming new buy)
                    purchase_price: prev.purchase_price === 0 ? quote.regular_market_price : prev.purchase_price
                }))
                setError(null)
            } else {
                setError("Could not fetch price for this symbol")
            }
        } catch (e) {
            setError("Failed to fetch price")
        } finally {
            setFetchLoading(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

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
        } catch (error: any) {
            console.error("Failed to save investment", error)
            const errorMessage = error.message || "Failed to save investment. Please try again."
            setError(errorMessage)
        }
    }

    const isLoading = createMutation.isPending || updateMutation.isPending

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{investmentToEdit ? "Edit Investment" : "Add Investment"}</DialogTitle>
                    <DialogDescription>
                        {investmentToEdit
                            ? "Update the details of your investment."
                            : "Add a new investment to your portfolio."}
                    </DialogDescription>
                </DialogHeader>
                {error && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <div className="font-medium ml-2">Error</div>
                        <AlertDescription className="ml-2">{error}</AlertDescription>
                    </Alert>
                )}
                <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">
                            Name
                        </Label>
                        <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="col-span-3"
                            required
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="symbol" className="text-right">
                            Symbol
                        </Label>
                        <div className="col-span-3 flex gap-2">
                            <Input
                                id="symbol"
                                value={formData.symbol}
                                onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
                                placeholder="e.g. AAPL, BTC-USD"
                                required
                            />
                            <Button type="button" size="icon" variant="outline" onClick={handleFetchPrice} disabled={fetchLoading || !formData.symbol}>
                                {fetchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                            </Button>
                        </div>
                        <div className="col-start-2 col-span-3 text-xs text-muted-foreground">
                            Enter exact symbol (Search list unavailable due to API limits). Auto-fills name & price.
                        </div>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="type" className="text-right">
                            Type
                        </Label>
                        <Select
                            value={formData.type}
                            onValueChange={(value) => setFormData({ ...formData, type: value as InvestmentType })}
                        >
                            <SelectTrigger className="w-[180px] col-span-3">
                                <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={InvestmentType.STOCK}>Stock</SelectItem>
                                <SelectItem value={InvestmentType.CRYPTO}>Crypto</SelectItem>
                                <SelectItem value={InvestmentType.FIXED_INCOME}>Fixed Income</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="quantity" className="text-right">
                            Quantity
                        </Label>
                        <Input
                            id="quantity"
                            type="number"
                            step="any"
                            value={formData.quantity}
                            onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) })}
                            className="col-span-3"
                            required
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="purchase_price" className="text-right">
                            Purchase Price
                        </Label>
                        <Input
                            id="purchase_price"
                            type="number"
                            step="any"
                            value={formData.purchase_price}
                            onChange={(e) => setFormData({ ...formData, purchase_price: parseFloat(e.target.value) })}
                            className="col-span-3"
                            required
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="current_price" className="text-right">
                            Current Price
                        </Label>
                        <Input
                            id="current_price"
                            type="number"
                            step="any"
                            value={formData.current_price}
                            onChange={(e) => setFormData({ ...formData, current_price: parseFloat(e.target.value) })}
                            className="col-span-3"
                            required
                        />
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {investmentToEdit ? "Update" : "Create"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
