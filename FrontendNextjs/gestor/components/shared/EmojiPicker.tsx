'use client'

import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

/** Default category icons; `key` names the label under `common.picker.emojis`. */
export const CATEGORY_EMOJIS = [
	{ value: '🏷️', key: 'tag' },
	{ value: '🍔', key: 'food' },
	{ value: '🛒', key: 'groceries' },
	{ value: '☕', key: 'coffee' },
	{ value: '🏠', key: 'home' },
	{ value: '💡', key: 'utilities' },
	{ value: '⚡', key: 'electricity' },
	{ value: '🚗', key: 'transport' },
	{ value: '✈️', key: 'travel' },
	{ value: '📱', key: 'tech' },
	{ value: '🛍️', key: 'shopping' },
	{ value: '👕', key: 'clothing' },
	{ value: '💄', key: 'beauty' },
	{ value: '💊', key: 'health' },
	{ value: '🏥', key: 'hospital' },
	{ value: '💪', key: 'fitness' },
	{ value: '💼', key: 'work' },
	{ value: '🎓', key: 'education' },
	{ value: '📚', key: 'books' },
	{ value: '🎮', key: 'entertainment' },
	{ value: '🎬', key: 'movies' },
	{ value: '🎵', key: 'music' },
	{ value: '🏀', key: 'sports' },
	{ value: '💰', key: 'money' },
	{ value: '💳', key: 'cards' },
	{ value: '🎁', key: 'gifts' },
	{ value: '🎉', key: 'celebration' },
	{ value: '🔧', key: 'maintenance' },
	{ value: '🐾', key: 'pets' },
	{ value: '🌱', key: 'nature' },
] as const

export interface PickerOption {
	value: string
	/** Accessible name of the option. */
	label: string
}

export interface EmojiPickerProps {
	value: string
	onChange: (value: string) => void
	/** Custom options; defaults to the translated CATEGORY_EMOJIS set. */
	options?: readonly PickerOption[]
	disabled?: boolean
	/** id of the visible label (e.g. a FormLabel / Label `id`). Falls back to `common.picker.emojiLabel`. */
	'aria-labelledby'?: string
	className?: string
}

/**
 * Grid of emoji toggle buttons for a category icon. Each option is a 40px
 * button with an accessible name and `aria-pressed`; the group is labelled.
 *
 * @example
 * <Label id='icon-label'>{t('icon')}</Label>
 * <EmojiPicker aria-labelledby='icon-label' value={field.value} onChange={field.onChange} />
 */
export function EmojiPicker({
	value,
	onChange,
	options,
	disabled = false,
	'aria-labelledby': labelledBy,
	className,
}: EmojiPickerProps) {
	const t = useTranslations('common.picker')
	const items = options ?? CATEGORY_EMOJIS.map((item) => ({ value: item.value, label: t(`emojis.${item.key}`) }))

	return (
		<fieldset aria-labelledby={labelledBy} aria-label={labelledBy ? undefined : t('emojiLabel')} className='min-w-0'>
			<div className={cn('grid grid-cols-[repeat(auto-fill,minmax(2.5rem,1fr))] gap-1', className)}>
				{items.map((item) => {
					const selected = item.value === value
					return (
						<button
							key={item.value}
							type='button'
							aria-label={item.label}
							aria-pressed={selected}
							title={item.label}
							disabled={disabled}
							onClick={() => onChange(item.value)}
							className={cn(
								'flex h-10 w-10 items-center justify-center rounded-md text-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background disabled:pointer-events-none disabled:opacity-50',
								selected ? 'bg-accent ring-2 ring-primary' : 'hover:bg-muted',
							)}
						>
							<span aria-hidden='true'>{item.value}</span>
						</button>
					)
				})}
			</div>
		</fieldset>
	)
}
