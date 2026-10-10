import { ScopedIntlMessages } from '@/components/i18n/ScopedIntlMessages'

/** Client messages for this section (see lib/i18n/client-messages.ts). */
export default function TransactionsLayout({ children }: { children: React.ReactNode }) {
	return <ScopedIntlMessages scope='transactions'>{children}</ScopedIntlMessages>
}
