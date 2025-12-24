'use client'

import { createContext, useContext, useState, ReactNode } from 'react'
import { DateRange } from 'react-day-picker'

const now = new Date()
const defaultMonth = String(now.getMonth() + 1).padStart(2, '0')
const defaultYear = String(now.getFullYear())

export interface AnalysisFiltersState {
    filterMode: 'month' | 'range'
    month: string
    year: string
    dateRange: DateRange
    account: string
    category: string
    type: string
    minAmount: string
    maxAmount: string
    search: string
}

interface AnalysisContextType {
    filters: AnalysisFiltersState
    setFilters: React.Dispatch<React.SetStateAction<AnalysisFiltersState>>
}

const AnalysisContext = createContext<AnalysisContextType | undefined>(undefined)

export function AnalysisProvider({ children }: { children: ReactNode }) {
    const [filters, setFilters] = useState<AnalysisFiltersState>({
        filterMode: 'month',
        month: defaultMonth,
        year: defaultYear,
        dateRange: { from: undefined, to: undefined },
        account: 'all',
        category: 'all',
        type: 'all',
        minAmount: '',
        maxAmount: '',
        search: '',
    })

    return (
        <AnalysisContext.Provider value={{ filters, setFilters }}>
            {children}
        </AnalysisContext.Provider>
    )
}

export function useAnalysisContext() {
    const context = useContext(AnalysisContext)
    if (!context) {
        throw new Error('useAnalysisContext must be used within an AnalysisProvider')
    }
    return context
}
