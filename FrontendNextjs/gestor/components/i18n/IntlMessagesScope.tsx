'use client'

import { type AbstractIntlMessages, NextIntlClientProvider, useLocale, useMessages } from 'next-intl'
import { type ReactNode, useMemo } from 'react'

/**
 * Adds namespaces to the messages of the surrounding NextIntlClientProvider
 * (a nested provider replaces messages, it does not merge them). Locale, time
 * zone, formats and error handling are inherited from the parent provider.
 */
export function IntlMessagesScope({ messages, children }: { messages: AbstractIntlMessages; children: ReactNode }) {
	const parent = useMessages()
	const locale = useLocale()
	const merged = useMemo(() => ({ ...parent, ...messages }), [parent, messages])
	return (
		<NextIntlClientProvider locale={locale} messages={merged}>
			{children}
		</NextIntlClientProvider>
	)
}
