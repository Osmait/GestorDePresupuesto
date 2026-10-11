'use client'

import { Check, Pipette } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useId } from 'react'
import { cn } from '@/lib/utils'
import type { PickerOption } from './EmojiPicker'

/** Default category colors (user data, so raw hex is fine here); `key` names the label under `common.picker.colors`. */
export const CATEGORY_COLORS = [
	{ value: '#EF4444', key: 'red' },
	{ value: '#F97316', key: 'orange' },
	{ value: '#F59E0B', key: 'amber' },
	{ value: '#EAB308', key: 'yellow' },
	{ value: '#84CC16', key: 'lime' },
	{ value: '#22C55E', key: 'green' },
	{ value: '#10B981', key: 'emerald' },
	{ value: '#14B8A6', key: 'teal' },
	{ value: '#06B6D4', key: 'cyan' },
	{ value: '#0EA5E9', key: 'sky' },
	{ value: '#3B82F6', key: 'blue' },
	{ value: '#6366F1', key: 'indigo' },
	{ value: '#8B5CF6', key: 'violet' },
	{ value: '#A855F7', key: 'purple' },
	{ value: '#D946EF', key: 'fuchsia' },
	{ value: '#EC4899', key: 'pink' },
	{ value: '#F43F5E', key: 'rose' },
	{ value: '#64748B', key: 'slate' },
	{ value: '#6B7280', key: 'gray' },
	{ value: '#71717A', key: 'zinc' },
] as const

/** Color given to categories created on the fly (quick create, AI import): the palette's green. */
export const DEFAULT_CATEGORY_COLOR: string = CATEGORY_COLORS[5].value

const HEX_RE = /^#[0-9a-f]{6}$/i

const sameColor = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

export interface ColorSwatchPickerProps {
	/** Hex color (case-insensitive match against the options). */
	value: string
	onChange: (value: string) => void
	/** Custom options; defaults to the translated CATEGORY_COLORS set. */
	options?: readonly PickerOption[]
	/** Adds a 'custom color' swatch backed by the native color input. */
	allowCustom?: boolean
	disabled?: boolean
	/** id of the visible label. Falls back to `common.picker.colorLabel`. */
	'aria-labelledby'?: string
	className?: string
}

/**
 * Row of color swatches for a category color. Each swatch is a 40px toggle
 * button with the color's name and `aria-pressed`; the selected one also
 * shows a check mark, so selection never depends on the ring color alone.
 *
 * @example
 * <ColorSwatchPicker aria-labelledby='color-label' value={field.value} onChange={field.onChange} allowCustom />
 */
export function ColorSwatchPicker({
	value,
	onChange,
	options,
	allowCustom = false,
	disabled = false,
	'aria-labelledby': labelledBy,
	className,
}: ColorSwatchPickerProps) {
	const t = useTranslations('common.picker')
	const customId = useId()
	const items = options ?? CATEGORY_COLORS.map((item) => ({ value: item.value, label: t(`colors.${item.key}`) }))
	const isCustom = Boolean(value) && !items.some((item) => sameColor(item.value, value))

	return (
		<fieldset aria-labelledby={labelledBy} aria-label={labelledBy ? undefined : t('colorLabel')} className='min-w-0'>
			<div className={cn('flex flex-wrap gap-1', className)}>
				{items.map((item) => {
					const selected = sameColor(item.value, value)
					return (
						<button
							key={item.value}
							type='button'
							aria-label={item.label}
							aria-pressed={selected}
							title={item.label}
							disabled={disabled}
							onClick={() => onChange(item.value)}
							className='group flex h-10 w-10 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background disabled:pointer-events-none disabled:opacity-50'
						>
							<span
								aria-hidden='true'
								className={cn(
									'flex h-7 w-7 items-center justify-center rounded-full border border-foreground/15 transition-transform',
									selected ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background' : 'group-hover:scale-110',
								)}
								style={{ backgroundColor: item.value }}
							>
								{selected ? <Check className='h-4 w-4 text-white drop-shadow-[0_1px_1px_rgb(0_0_0/0.6)]' /> : null}
							</span>
						</button>
					)
				})}
				{allowCustom ? (
					<label
						htmlFor={customId}
						title={t('customColor')}
						className={cn(
							'relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-full focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ring-offset-background',
							disabled && 'pointer-events-none opacity-50',
						)}
					>
						<span
							aria-hidden='true'
							className={cn(
								'flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-muted-foreground/60 text-muted-foreground',
								isCustom && 'border-solid ring-2 ring-foreground ring-offset-2 ring-offset-background',
							)}
							style={isCustom ? { backgroundColor: value } : undefined}
						>
							{isCustom ? (
								<Check className='h-4 w-4 text-white drop-shadow-[0_1px_1px_rgb(0_0_0/0.6)]' />
							) : (
								<Pipette className='h-3.5 w-3.5' />
							)}
						</span>
						<span className='sr-only'>{t('customColor')}</span>
						<input
							id={customId}
							type='color'
							value={HEX_RE.test(value) ? value.toLowerCase() : '#000000'}
							disabled={disabled}
							onChange={(event) => onChange(event.target.value)}
							className='absolute inset-0 h-full w-full cursor-pointer opacity-0'
						/>
					</label>
				) : null}
			</div>
		</fieldset>
	)
}
