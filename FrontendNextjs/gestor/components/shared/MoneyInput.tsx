import type { ComponentProps } from 'react'
import { Input } from '@/components/ui/input'
import { toMoneyInputText } from '@/lib/money-input'

type MoneyInputProps = Omit<ComponentProps<typeof Input>, 'type' | 'value'> & {
	/** The field's text, or a number from the form defaults (shown in plain decimal notation). */
	value?: string | number | null
}

/**
 * Text field for amounts. It is never `type="number"`: number inputs parse with the
 * browser locale (Chromium es-DO drops the comma of "1500,50"; Firefox/Safari return '').
 * The form parses the text with `moneySchema` / `parseMoneyInput` from `@/lib/money-input`.
 */
export function MoneyInput({ value, ...props }: MoneyInputProps) {
	return (
		<Input
			type='text'
			inputMode='decimal'
			autoComplete='off'
			autoCorrect='off'
			spellCheck={false}
			{...props}
			value={toMoneyInputText(value)}
		/>
	)
}
