import { type RenderOptions, render } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import type { ReactElement, ReactNode } from 'react'
import en from '@/messages/en.json'
import es from '@/messages/es.json'

const MESSAGES = { en, es } as const

type Locale = keyof typeof MESSAGES

function IntlProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
	return (
		<NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} timeZone='UTC'>
			{children}
		</NextIntlClientProvider>
	)
}

// One module-level wrapper per locale: a wrapper component created inside
// renderWithIntl would be a new component type on every call.
function EnglishWrapper({ children }: { children: ReactNode }) {
	return <IntlProvider locale='en'>{children}</IntlProvider>
}

function SpanishWrapper({ children }: { children: ReactNode }) {
	return <IntlProvider locale='es'>{children}</IntlProvider>
}

const WRAPPERS: Record<Locale, (props: { children: ReactNode }) => ReactElement> = {
	en: EnglishWrapper,
	es: SpanishWrapper,
}

/** Renders `ui` inside a NextIntlClientProvider backed by the real message catalogs. */
export function renderWithIntl(
	ui: ReactElement,
	{ locale = 'en', ...options }: RenderOptions & { locale?: Locale } = {},
) {
	return render(ui, { wrapper: WRAPPERS[locale], ...options })
}
