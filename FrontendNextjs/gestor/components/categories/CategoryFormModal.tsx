'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { useEffect, useId, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { useCategoryContext } from '@/components/categories/CategoryContext'
import { CATEGORY_COLORS, ColorSwatchPicker } from '@/components/shared/ColorSwatchPicker'
import { EmojiPicker } from '@/components/shared/EmojiPicker'
import { FormDialog } from '@/components/shared/FormDialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'

interface CategoryFormModalProps {
	open: boolean
	setOpen: (_open: boolean) => void
	onCreateCategory: (_name: string, _icon: string, _color: string) => Promise<void>
}

// New categories start as "tag" in the palette's blue (user data, from the shared picker).
const DEFAULT_VALUES = {
	name: '',
	icon: '🏷️',
	color: CATEGORY_COLORS.find((item) => item.key === 'blue')?.value ?? CATEGORY_COLORS[0].value,
}

export function CategoryFormModal({ open, setOpen, onCreateCategory }: CategoryFormModalProps) {
	const t = useTranslations('forms')
	const tCat = useTranslations('categories')
	const { editingCategory, updateCategory } = useCategoryContext()
	const [submitError, setSubmitError] = useState<string | null>(null)
	const iconLabelId = useId()
	const colorLabelId = useId()

	const isEditing = !!editingCategory

	const categorySchema = useMemo(
		() =>
			z.object({
				name: z.string().trim().min(1, t('nameRequired')),
				icon: z.string().min(1),
				color: z.string().min(1),
			}),
		[t],
	)
	type CategoryFormValues = z.infer<typeof categorySchema>

	const form = useForm<CategoryFormValues>({
		resolver: zodResolver(categorySchema),
		defaultValues: DEFAULT_VALUES,
	})

	useEffect(() => {
		if (editingCategory) {
			form.reset({
				name: editingCategory.name,
				icon: editingCategory.icon,
				color: editingCategory.color,
			})
		} else {
			form.reset(DEFAULT_VALUES)
		}
	}, [editingCategory, form])

	function handleOpenChange(next: boolean) {
		if (!next) setSubmitError(null)
		setOpen(next)
	}

	const onSubmit = async (values: CategoryFormValues) => {
		setSubmitError(null)
		try {
			if (isEditing && editingCategory) {
				await updateCategory(editingCategory.id, values.name, values.icon, values.color)
			} else {
				await onCreateCategory(values.name, values.icon, values.color)
			}
			setOpen(false)
		} catch {
			setSubmitError(tCat('saveError'))
		}
	}

	return (
		<FormDialog
			open={open}
			onOpenChange={handleOpenChange}
			title={isEditing ? t('editCategory') : t('newCategory')}
			description={isEditing ? tCat('editDescription') : tCat('addDescription')}
			submitLabel={isEditing ? t('saveChanges') : t('createCategory')}
			loading={form.formState.isSubmitting}
			error={submitError}
			onSubmit={form.handleSubmit(onSubmit)}
		>
			<Form {...form}>
				<div className='space-y-4'>
					<FormField
						control={form.control}
						name='name'
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t('name')}</FormLabel>
								<FormControl>
									<Input placeholder={t('namePlaceholder')} autoComplete='off' {...field} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name='icon'
						render={({ field }) => (
							<FormItem>
								<FormLabel id={iconLabelId}>{t('icon')}</FormLabel>
								<EmojiPicker aria-labelledby={iconLabelId} value={field.value} onChange={field.onChange} />
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name='color'
						render={({ field }) => (
							<FormItem>
								<FormLabel id={colorLabelId}>{t('color')}</FormLabel>
								<ColorSwatchPicker
									aria-labelledby={colorLabelId}
									value={field.value}
									onChange={field.onChange}
									allowCustom
								/>
								<FormMessage />
							</FormItem>
						)}
					/>
				</div>
			</Form>
		</FormDialog>
	)
}
