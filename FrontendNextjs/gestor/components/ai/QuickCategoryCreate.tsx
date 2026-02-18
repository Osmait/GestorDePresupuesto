'use client'

import { useState } from 'react'
import { Plus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { Category } from '@/types/category'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'

const EMOJI_ICONS = [
	'🍕',
	'🛒',
	'🚗',
	'💊',
	'🎬',
	'📱',
	'💡',
	'🏠',
	'✈️',
	'🎓',
	'💪',
	'🎮',
	'📚',
	'☕',
	'👕',
	'🔧',
	'🎁',
	'💳',
	'🏥',
	'🐾',
	'🍔',
	'⚡',
	'🎵',
	'💄',
	'🌱',
]

const COLORS = [
	{ name: 'Red', value: '#ef4444' },
	{ name: 'Orange', value: '#f97316' },
	{ name: 'Yellow', value: '#eab308' },
	{ name: 'Green', value: '#22c55e' },
	{ name: 'Blue', value: '#3b82f6' },
	{ name: 'Purple', value: '#a855f7' },
	{ name: 'Pink', value: '#ec4899' },
	{ name: 'Gray', value: '#6b7280' },
]

interface QuickCategoryCreateProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	onCategoryCreated: (category: Category) => void
	isCreating?: boolean
}

export function QuickCategoryCreate({
	open,
	onOpenChange,
	onCategoryCreated,
	isCreating = false,
}: QuickCategoryCreateProps) {
	const t = useTranslations('ai.quickCategory')
	const tCommon = useTranslations('ai.common')
	const [name, setName] = useState('')
	const [selectedIcon, setSelectedIcon] = useState('📦')
	const [selectedColor, setSelectedColor] = useState(COLORS[3].value)

	const handleCreate = () => {
		if (!name.trim()) return

		const newCategory: Category = {
			id: `temp-${Date.now()}`,
			name: name.trim(),
			icon: selectedIcon,
			color: selectedColor,
			created_at: new Date().toISOString(),
		}

		onCategoryCreated(newCategory)
		handleReset()
	}

	const handleReset = () => {
		setName('')
		setSelectedIcon('📦')
		setSelectedColor(COLORS[3].value)
	}

	const handleClose = () => {
		handleReset()
		onOpenChange(false)
	}

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{t('title')}</DialogTitle>
					<DialogDescription>{t('description')}</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<div>
						<label className="text-sm font-medium mb-2 block">{t('name')}</label>
						<Input
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder={t('namePlaceholder')}
							disabled={isCreating}
						/>
					</div>

					<div>
						<label className="text-sm font-medium mb-2 block">{t('icon')}</label>
						<div className="grid grid-cols-9 gap-1.5">
							{EMOJI_ICONS.map((icon) => (
								<button
									key={icon}
									type="button"
									onClick={() => setSelectedIcon(icon)}
									disabled={isCreating}
									className={cn(
										'h-8 w-8 flex items-center justify-center text-lg rounded-md transition-colors',
										selectedIcon === icon
											? 'bg-primary text-primary-foreground'
											: 'bg-muted hover:bg-muted/80'
									)}
								>
									{icon}
								</button>
							))}
						</div>
					</div>

					<div>
						<label className="text-sm font-medium mb-2 block">{t('color')}</label>
						<div className="flex gap-2 flex-wrap">
							{COLORS.map((color) => (
								<button
									key={color.value}
									type="button"
									onClick={() => setSelectedColor(color.value)}
									disabled={isCreating}
									className={cn(
										'h-8 w-8 rounded-full transition-all',
										selectedColor === color.value
											? 'ring-2 ring-offset-2 ring-primary'
											: 'hover:scale-110'
									)}
									style={{ backgroundColor: color.value }}
									title={color.name}
								/>
							))}
						</div>
					</div>

					<div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
						<span className="text-2xl">{selectedIcon}</span>
						<span className="font-medium">{name || t('preview')}</span>
						<span
							className="w-3 h-3 rounded-full ml-auto"
							style={{ backgroundColor: selectedColor }}
						/>
					</div>
				</div>

				<div className="flex justify-end gap-2 mt-4">
					<Button variant="outline" onClick={handleClose} disabled={isCreating}>
						{tCommon('cancel')}
					</Button>
					<Button onClick={handleCreate} disabled={!name.trim() || isCreating}>
						{isCreating ? (
							<>
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								{tCommon('creating')}
							</>
						) : (
							<>
								<Plus className="h-4 w-4 mr-2" />
								{tCommon('create')}
							</>
						)}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	)
}
