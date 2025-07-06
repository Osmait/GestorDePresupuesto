'use client'

import { useState, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { useSettings } from '../../contexts'

interface SidebarControllerProps {
	children: (props: {
		isCollapsed: boolean
		isMobileOpen: boolean
		isHovered: boolean
		isExpanded: boolean
		sidebarHoverEnabled: boolean
		toggleCollapsed: () => void
		toggleMobile: () => void
		handleMouseEnter: () => void
		handleMouseLeave: () => void
		getSidebarClassName: () => string
	}) => ReactNode
}

export function SidebarController({ children }: SidebarControllerProps) {
	const [isCollapsed, setIsCollapsed] = useState(false)
	const [isMobileOpen, setIsMobileOpen] = useState(false)
	const [isHovered, setIsHovered] = useState(false)
	const { sidebarHoverEnabled } = useSettings()

	const toggleCollapsed = () => {
		setIsCollapsed(!isCollapsed)
	}

	const toggleMobile = () => {
		setIsMobileOpen(!isMobileOpen)
	}

	const handleMouseEnter = () => {
		if (sidebarHoverEnabled && isCollapsed) {
			setTimeout(() => {
				setIsHovered(true)
			}, 100)
		}
	}

	const handleMouseLeave = () => {
		if (sidebarHoverEnabled && isCollapsed) {
			setIsHovered(false)
		}
	}

	const isExpanded = !isCollapsed || (isCollapsed && isHovered && sidebarHoverEnabled)

	const getSidebarClassName = () => {
		return cn(
			'fixed left-0 top-0 z-50 h-full bg-gradient-to-b from-background via-background to-muted/20 border-r border-border/50 transition-all duration-300 lg:relative lg:translate-x-0',
			isExpanded ? 'w-64' : 'w-16',
			isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
		)
	}

	return (
		<>
			{children({
				isCollapsed,
				isMobileOpen,
				isHovered,
				isExpanded,
				sidebarHoverEnabled,
				toggleCollapsed,
				toggleMobile,
				handleMouseEnter,
				handleMouseLeave,
				getSidebarClassName
			})}
		</>
	)
} 