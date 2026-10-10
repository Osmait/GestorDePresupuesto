import type { AbstractIntlMessages } from 'next-intl'
import { getMessages } from 'next-intl/server'
import type { ReactNode } from 'react'
import { IntlMessagesScope } from '@/components/i18n/IntlMessagesScope'
import { CLIENT_NAMESPACES, type ClientMessagesScope, pickMessages } from '@/lib/i18n/client-messages'

/** Server component: makes the namespaces of `scope` available to the client components below it. */
export async function ScopedIntlMessages({ scope, children }: { scope: ClientMessagesScope; children: ReactNode }) {
	const messages = (await getMessages()) as Record<string, unknown>
	return (
		<IntlMessagesScope messages={pickMessages(messages, CLIENT_NAMESPACES[scope]) as AbstractIntlMessages}>
			{children}
		</IntlMessagesScope>
	)
}
