'use client'

import { ReactNode } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

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

export function TabsController({ tabs, defaultValue, className, listClassName }: TabsControllerProps) {
	return (
		<Tabs defaultValue={defaultValue} className={className}>
			<TabsList className={listClassName}>
				{tabs.map((tab) => (
					<TabsTrigger 
						key={tab.value} 
						value={tab.value} 
						className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground"
					>
						{tab.icon}
						<span className="hidden sm:inline">{tab.label}</span>
					</TabsTrigger>
				))}
			</TabsList>

			{tabs.map((tab) => (
				<TabsContent key={tab.value} value={tab.value} className="space-y-6">
					{tab.content}
				</TabsContent>
			))}
		</Tabs>
	)
} 