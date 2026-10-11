'use client'

import { useTranslations } from 'next-intl'
import { useId, useState } from 'react'
import { CATEGORY_COLORS, ColorSwatchPicker } from '@/components/shared/ColorSwatchPicker'
import { CATEGORY_EMOJIS, EmojiPicker } from '@/components/shared/EmojiPicker'
import { FormDialog } from '@/components/shared/FormDialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Category } from '@/types/category'

const DEFAULT_ICON = CATEGORY_EMOJIS[0].value
const DEFAULT_COLOR = CATEGORY_COLORS.find((color) => color.key === 'green')?.value ?? CATEGORY_COLORS[0].value

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
	const id = useId()
	const [name, setName] = useState('')
	const [selectedIcon, setSelectedIcon] = useState<string>(DEFAULT_ICON)
	const [selectedColor, setSelectedColor] = useState<string>(DEFAULT_COLOR)

	const handleReset = () => {
		setName('')
		setSelectedIcon(DEFAULT_ICON)
		setSelectedColor(DEFAULT_COLOR)
	}

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

	const handleOpenChange = (next: boolean) => {
		if (!next) handleReset()
		onOpenChange(next)
	}

	return (
		<FormDialog
			open={open}
			onOpenChange={handleOpenChange}
			title={t('title')}
			description={t('description')}
			size='sm'
			submitLabel={tCommon('create')}
			cancelLabel={tCommon('cancel')}
			loading={isCreating}
			submitDisabled={!name.trim()}
			onSubmit={handleCreate}
		>
			<div className='space-y-4'>
				<div className='space-y-2'>
					<Label htmlFor={`${id}-name`}>{t('name')}</Label>
					<Input
						id={`${id}-name`}
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder={t('namePlaceholder')}
						disabled={isCreating}
						autoComplete='off'
					/>
				</div>

				<div className='space-y-2'>
					<p id={`${id}-icon`} className='text-sm font-medium'>
						{t('icon')}
					</p>
					<EmojiPicker
						aria-labelledby={`${id}-icon`}
						value={selectedIcon}
						onChange={setSelectedIcon}
						disabled={isCreating}
					/>
				</div>

				<div className='space-y-2'>
					<p id={`${id}-color`} className='text-sm font-medium'>
						{t('color')}
					</p>
					<ColorSwatchPicker
						aria-labelledby={`${id}-color`}
						value={selectedColor}
						onChange={setSelectedColor}
						disabled={isCreating}
					/>
				</div>

				<div className='flex items-center gap-2 rounded-lg bg-muted p-3' aria-hidden='true'>
					<span className='text-2xl'>{selectedIcon}</span>
					<span className='font-medium'>{name || t('preview')}</span>
					<span className='ml-auto h-3 w-3 rounded-full' style={{ backgroundColor: selectedColor }} />
				</div>
			</div>
		</FormDialog>
	)
}
