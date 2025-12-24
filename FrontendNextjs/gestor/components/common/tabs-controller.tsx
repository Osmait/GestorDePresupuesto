'use client'

import { ReactNode } from 'react'
import { AnimatedTabs } from '@/components/common/animated-tabs'

interface Tab {
	value: string
	label: string
	icon?: ReactNode
	content: ReactNode
}

interface TabsControllerProps {
	tabs: Tab[]
	defaultValue: string
	className?: string
	listClassName?: string
}

export function TabsController({ tabs, defaultValue, className }: TabsControllerProps) {
	return (
		<AnimatedTabs
			tabs={tabs}
			defaultValue={defaultValue}
			className={className}
		/>
	)
} 