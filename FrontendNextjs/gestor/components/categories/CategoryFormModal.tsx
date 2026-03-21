'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { useCategoryContext } from '@/components/categories/CategoryContext'
import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'

interface CategoryFormModalProps {
	open: boolean
	setOpen: (_open: boolean) => void
	onCreateCategory: (_name: string, _icon: string, _color: string) => Promise<void>
}

// Predefined Emojis
const EMOJIS = [
	{ icon: '🏷️', labelKey: 'tag' },
	{ icon: '🍔', labelKey: 'food' },
	{ icon: '☕', labelKey: 'coffee' },
	{ icon: '🏠', labelKey: 'home' },
	{ icon: '🚗', labelKey: 'transport' },
	{ icon: '📱', labelKey: 'tech' },
	{ icon: '✈️', labelKey: 'travel' },
	{ icon: '🛍️', labelKey: 'shopping' },
	{ icon: '💊', labelKey: 'health' },
	{ icon: '💼', labelKey: 'work' },
	{ icon: '🎓', labelKey: 'education' },
	{ icon: '🎮', labelKey: 'entertainment' },
	{ icon: '🏀', labelKey: 'sports' },
	{ icon: '💰', labelKey: 'money' },
	{ icon: '💳', labelKey: 'cards' },
	{ icon: '🎉', labelKey: 'other' },
	{ icon: '💡', labelKey: 'services' },
	{ icon: '🔧', labelKey: 'maintenance' },
	{ icon: '🐾', labelKey: 'pets' },
	{ icon: '🎁', labelKey: 'gifts' },
]

// Predefined colors
const COLORS = [
	{ name: 'red', value: '#EF4444' },
	{ name: 'orange', value: '#F97316' },
	{ name: 'amber', value: '#F59E0B' },
	{ name: 'yellow', value: '#EAB308' },
	{ name: 'lime', value: '#84CC16' },
	{ name: 'green', value: '#22C55E' },
	{ name: 'emerald', value: '#10B981' },
	{ name: 'teal', value: '#14B8A6' },
	{ name: 'cyan', value: '#06B6D4' },
	{ name: 'sky', value: '#0EA5E9' },
	{ name: 'blue', value: '#3B82F6' },
	{ name: 'indigo', value: '#6366F1' },
	{ name: 'violet', value: '#8B5CF6' },
	{ name: 'purple', value: '#A855F7' },
	{ name: 'fuchsia', value: '#D946EF' },
	{ name: 'pink', value: '#EC4899' },
	{ name: 'rose', value: '#F43F5E' },
	{ name: 'slate', value: '#64748B' },
	{ name: 'gray', value: '#6B7280' },
	{ name: 'zinc', value: '#71717A' },
]

const categorySchema = z.object({
	name: z.string().min(1, 'Required'),
	icon: z.string().min(1),
	color: z.string().min(1),
})

type CategoryFormValues = z.infer<typeof categorySchema>

export function CategoryFormModal({ open, setOpen, onCreateCategory }: CategoryFormModalProps) {
	const t = useTranslations('forms')
	const tCat = useTranslations('categories')
	const { editingCategory, updateCategory } = useCategoryContext()

	const isEditing = !!editingCategory

	const form = useForm<CategoryFormValues>({
		resolver: zodResolver(categorySchema),
		defaultValues: {
			name: '',
			icon: '🏷️',
			color: '#3B82F6',
		},
	})

	useEffect(() => {
		if (editingCategory) {
			form.reset({
				name: editingCategory.name,
				icon: editingCategory.icon,
				color: editingCategory.color,
			})
		} else {
			form.reset({ name: '', icon: '🏷️', color: '#3B82F6' })
		}
	}, [editingCategory, form])

	const onSubmit = async (values: CategoryFormValues) => {
		try {
			if (isEditing && editingCategory) {
				await updateCategory(editingCategory.id, values.name, values.icon, values.color)
			} else {
				await onCreateCategory(values.name, values.icon, values.color)
			}
			setOpen(false)
		} catch (error) {
			console.error('Error saving category:', error)
		}
	}

	const selectedIcon = form.watch('icon')
	const selectedColor = form.watch('color')

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogContent className='sm:max-w-[425px]'>
				<DialogHeader>
					<DialogTitle>{isEditing ? t('editCategory') : t('newCategory')}</DialogTitle>
					<DialogDescription>{isEditing ? tCat('editDescription') : tCat('addDescription')}</DialogDescription>
				</DialogHeader>
				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4 py-4'>
						<FormField
							control={form.control}
							name='name'
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t('name')}</FormLabel>
									<FormControl>
										<Input placeholder={t('namePlaceholder')} {...field} />
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
									<FormLabel>{t('icon')}</FormLabel>
									<FormControl>
										<div className='grid grid-cols-5 gap-2 p-2 border rounded-md max-h-[150px] overflow-y-auto'>
											{EMOJIS.map((item) => (
												<button
													key={item.labelKey}
													type='button'
													className={`text-2xl h-10 w-10 flex items-center justify-center rounded-md hover:bg-muted transition-colors ${selectedIcon === item.icon ? 'bg-muted ring-2 ring-primary' : ''}`}
													onClick={() => field.onChange(item.icon)}
												>
													{item.icon}
												</button>
											))}
										</div>
									</FormControl>
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name='color'
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t('color')}</FormLabel>
									<FormControl>
										<div className='flex flex-wrap gap-2 p-2 border rounded-md'>
											{COLORS.map((c) => (
												<button
													key={c.name}
													type='button'
													className={`w-6 h-6 rounded-full border border-gray-200 transition-transform hover:scale-110 ${selectedColor === c.value ? 'ring-2 ring-offset-2 ring-black dark:ring-white scale-110' : ''}`}
													style={{ backgroundColor: c.value }}
													onClick={() => field.onChange(c.value)}
												/>
											))}
											<div
												className='relative w-6 h-6 rounded-full overflow-hidden border border-gray-200 transition-transform hover:scale-110'
												style={{
													background:
														'conic-gradient(from 0deg, red, orange, yellow, green, blue, indigo, violet, red)',
												}}
											>
												<Input
													type='color'
													value={selectedColor}
													onChange={(e) => field.onChange(e.target.value)}
													className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] p-0 border-0 cursor-pointer opacity-0'
												/>
											</div>
										</div>
									</FormControl>
								</FormItem>
							)}
						/>
					</form>
				</Form>
				<DialogFooter>
					<Button variant='outline' onClick={() => setOpen(false)} disabled={form.formState.isSubmitting}>
						{t('cancel')}
					</Button>
					<Button
						onClick={form.handleSubmit(onSubmit)}
						disabled={form.formState.isSubmitting || !form.formState.isValid}
					>
						{form.formState.isSubmitting ? t('saving') : isEditing ? t('saveChanges') : t('createCategory')}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
