import { type RenderOptions, render } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import type { ReactElement, ReactNode } from 'react'
import en from '@/messages/en.json'
import es from '@/messages/es.json'

const MESSAGES = { en, es } as const

/** Renders `ui` inside a NextIntlClientProvider backed by the real message catalogs. */
export function renderWithIntl(
	ui: ReactElement,
	{ locale = 'en', ...options }: RenderOptions & { locale?: keyof typeof MESSAGES } = {},
) {
	function Wrapper({ children }: { children: ReactNode }) {
		return (
			<NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} timeZone='UTC'>
				{children}
			</NextIntlClientProvider>
		)
	}
	return render(ui, { wrapper: Wrapper, ...options })
}
