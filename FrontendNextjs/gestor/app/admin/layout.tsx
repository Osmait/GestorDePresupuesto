import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import '../../styles/globals.css'
import PageTransition from '@/components/common/page-transition'
import { Sidebar } from '@/components/common/sidebar'
import { ScopedIntlMessages } from '@/components/i18n/ScopedIntlMessages'
import { GlobalActionProvider } from '@/contexts/GlobalActionContext'
import { NotificationProvider } from '@/contexts/NotificationContext'
import { getServerSession } from '@/lib/server/session'
import { SettingsProvider } from '../../contexts'

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations('admin.meta')
	return { title: t('title'), description: t('description') }
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
	// Server-side guard (proxy.ts also enforces this): only admins render the backoffice.
	const session = await getServerSession()
	if (!session?.user || session.error) {
		redirect('/login?callbackUrl=%2Fadmin%2Fdashboard')
	}
	if (session.user.role !== 'ADMIN') {
		redirect('/app')
	}

	return (
		<ScopedIntlMessages scope='admin'>
			<SettingsProvider>
				<GlobalActionProvider>
					<NotificationProvider>
						<Sidebar>
							<PageTransition>{children}</PageTransition>
						</Sidebar>
					</NotificationProvider>
				</GlobalActionProvider>
			</SettingsProvider>
		</ScopedIntlMessages>
	)
}
