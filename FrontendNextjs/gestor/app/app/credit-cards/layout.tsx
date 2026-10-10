import { ScopedIntlMessages } from '@/components/i18n/ScopedIntlMessages'

/** Client messages for this section (see lib/i18n/client-messages.ts). */
export default function CreditCardsLayout({ children }: { children: React.ReactNode }) {
	return <ScopedIntlMessages scope='creditCards'>{children}</ScopedIntlMessages>
}
