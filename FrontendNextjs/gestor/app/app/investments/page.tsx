"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { InvestmentType, Investment } from "@/types/investment"
import { InvestmentList } from "@/components/investments/InvestmentList"
import { InvestmentDashboard } from "@/components/investments/InvestmentDashboard"
import { InvestmentFormModal } from "@/components/investments/InvestmentFormModal"

export default function InvestmentsPage() {
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [investmentToEdit, setInvestmentToEdit] = useState<Investment | null>(null)

    const handleEdit = (investment: Investment) => {
        setInvestmentToEdit(investment)
        setIsModalOpen(true)
    }

    return (
        <div className="container mx-auto py-10 space-y-8">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight">Investments</h1>
                <Button onClick={() => setIsModalOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Add Investment
                </Button>
            </div>

            <InvestmentDashboard />

            <Tabs defaultValue={InvestmentType.STOCK} className="space-y-4">
                <TabsList className="grid w-full grid-cols-3 md:w-[400px]">
                    <TabsTrigger value={InvestmentType.STOCK}>Stocks</TabsTrigger>
                    <TabsTrigger value={InvestmentType.CRYPTO}>Crypto</TabsTrigger>
                    <TabsTrigger value={InvestmentType.FIXED_INCOME}>Fixed Income</TabsTrigger>
                </TabsList>
                <TabsContent value={InvestmentType.STOCK} className="mt-4">
                    <InvestmentList type={InvestmentType.STOCK} onEdit={handleEdit} />
                </TabsContent>
                <TabsContent value={InvestmentType.CRYPTO} className="mt-4">
                    <InvestmentList type={InvestmentType.CRYPTO} onEdit={handleEdit} />
                </TabsContent>
                <TabsContent value={InvestmentType.FIXED_INCOME} className="mt-4">
                    <InvestmentList type={InvestmentType.FIXED_INCOME} onEdit={handleEdit} />
                </TabsContent>
            </Tabs>

            {isModalOpen && (
                <InvestmentFormModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    investmentToEdit={investmentToEdit}
                />
            )}
        </div>
    )
}
