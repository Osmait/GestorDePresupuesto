'use client'

import { createContext, ReactNode, useContext, useState } from 'react'
import { DateRange } from 'react-day-picker'

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

/** Filters on first load and after "Clear filters": the current month, everything else unfiltered. */
export function createDefaultAnalysisFilters(now = new Date()): AnalysisFiltersState {
	return {
		filterMode: 'month',
		month: String(now.getMonth() + 1).padStart(2, '0'),
		year: String(now.getFullYear()),
		dateRange: { from: undefined, to: undefined },
		account: 'all',
		category: 'all',
		type: 'all',
		minAmount: '',
		maxAmount: '',
		search: '',
	}
}

const AnalysisContext = createContext<AnalysisContextType | undefined>(undefined)

export function AnalysisProvider({ children }: { children: ReactNode }) {
	const [filters, setFilters] = useState<AnalysisFiltersState>(() => createDefaultAnalysisFilters())

	return <AnalysisContext.Provider value={{ filters, setFilters }}>{children}</AnalysisContext.Provider>
}

export function useAnalysisContext() {
	const context = useContext(AnalysisContext)
	if (!context) {
		throw new Error('useAnalysisContext must be used within an AnalysisProvider')
	}
	return context
}
