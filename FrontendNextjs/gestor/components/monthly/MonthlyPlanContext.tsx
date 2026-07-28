'use client'

import { createContext, ReactNode, useContext, useMemo, useState } from 'react'
import { MonthlyPlanItem, MonthlyPlanItemType } from '@/types/monthlyPlan'

interface MonthlyPlanContextType {
	isModalOpen: boolean
	setModalOpen: (_isOpen: boolean) => void
	editingItem: MonthlyPlanItem | null
	setEditingItem: (_item: MonthlyPlanItem | null) => void
	/** Pre-selects income or bill when opening the form from a column header. */
	defaultType: MonthlyPlanItemType
	openCreate: (_type: MonthlyPlanItemType) => void
	openEdit: (_item: MonthlyPlanItem) => void
	closeModal: () => void
}

const MonthlyPlanContext = createContext<MonthlyPlanContextType | undefined>(undefined)

export function MonthlyPlanProvider({ children }: { children: ReactNode }) {
	const [isModalOpen, setModalOpen] = useState(false)
	const [editingItem, setEditingItem] = useState<MonthlyPlanItem | null>(null)
	const [defaultType, setDefaultType] = useState<MonthlyPlanItemType>('bill')

	const value = useMemo<MonthlyPlanContextType>(
		() => ({
			isModalOpen,
			setModalOpen,
			editingItem,
			setEditingItem,
			defaultType,
			openCreate: (type: MonthlyPlanItemType) => {
				setEditingItem(null)
				setDefaultType(type)
				setModalOpen(true)
			},
			openEdit: (item: MonthlyPlanItem) => {
				setEditingItem(item)
				setDefaultType(item.type)
				setModalOpen(true)
			},
			closeModal: () => {
				setModalOpen(false)
				setEditingItem(null)
			},
		}),
		[isModalOpen, editingItem, defaultType],
	)

	return <MonthlyPlanContext.Provider value={value}>{children}</MonthlyPlanContext.Provider>
}

export function useMonthlyPlanContext() {
	const context = useContext(MonthlyPlanContext)
	if (context === undefined) {
		throw new Error('useMonthlyPlanContext must be used within a MonthlyPlanProvider')
	}
	return context
}
