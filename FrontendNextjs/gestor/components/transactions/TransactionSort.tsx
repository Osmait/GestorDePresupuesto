'use client'

import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ArrowDownAZ, ArrowUpZA, CalendarDays, DollarSign, SortAsc } from "lucide-react"
import { useTransactionContext } from "./TransactionContext"
import { useTranslations } from 'next-intl'

export function TransactionSort() {
    const t = useTranslations('transactions')
    const { filters, setFilters } = useTransactionContext()

    const handleSortChange = (sortBy: string, sortOrder: 'asc' | 'desc') => {
        setFilters(prev => ({
            ...prev,
            sortBy,
            sortOrder
        }))
    }

    const currentSortLabel = () => {
        if (filters.sortBy === 'amount') return filters.sortOrder === 'desc' ? t('sortAmountDesc') : t('sortAmountAsc')
        if (filters.sortBy === 'transaction_name') return filters.sortOrder === 'asc' ? t('sortNameAsc') : t('sortNameDesc')
        return filters.sortOrder === 'asc' ? t('sortDateOld') : t('sortDateNew')
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-2">
                    <SortAsc className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{currentSortLabel()}</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>{t('sortBy')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">{t('date')}</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => handleSortChange('created_at', 'desc')}>
                        <CalendarDays className="mr-2 h-4 w-4" />
                        {t('newestFirst')}
                        {filters.sortBy === 'created_at' && filters.sortOrder === 'desc' && <span className="ml-auto text-xs">✓</span>}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleSortChange('created_at', 'asc')}>
                        <CalendarDays className="mr-2 h-4 w-4" />
                        {t('oldestFirst')}
                        {filters.sortBy === 'created_at' && filters.sortOrder === 'asc' && <span className="ml-auto text-xs">✓</span>}
                    </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">{t('amount')}</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => handleSortChange('amount', 'desc')}>
                        <DollarSign className="mr-2 h-4 w-4" />
                        {t('highestFirst')}
                        {filters.sortBy === 'amount' && filters.sortOrder === 'desc' && <span className="ml-auto text-xs">✓</span>}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleSortChange('amount', 'asc')}>
                        <DollarSign className="mr-2 h-4 w-4" />
                        {t('lowestFirst')}
                        {filters.sortBy === 'amount' && filters.sortOrder === 'asc' && <span className="ml-auto text-xs">✓</span>}
                    </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">{t('name')}</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => handleSortChange('transaction_name', 'asc')}>
                        <ArrowDownAZ className="mr-2 h-4 w-4" />
                        {t('nameAZ')}
                        {filters.sortBy === 'transaction_name' && filters.sortOrder === 'asc' && <span className="ml-auto text-xs">✓</span>}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleSortChange('transaction_name', 'desc')}>
                        <ArrowUpZA className="mr-2 h-4 w-4" />
                        {t('nameZA')}
                        {filters.sortBy === 'transaction_name' && filters.sortOrder === 'desc' && <span className="ml-auto text-xs">✓</span>}
                    </DropdownMenuItem>
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

