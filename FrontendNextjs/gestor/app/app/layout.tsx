import type { Metadata } from 'next'
import '../../styles/globals.css'
import { DemoTour } from '@/components/common/DemoTour'
import PageTransition from '@/components/common/page-transition'
import { Sidebar } from '@/components/common/sidebar'
import { ScopedIntlMessages } from '@/components/i18n/ScopedIntlMessages'
import { GlobalActionProvider } from '@/contexts/GlobalActionContext'
import { NotificationProvider } from '@/contexts/NotificationContext'
import { getServerSession } from '@/lib/server/session'
import { SettingsProvider } from '../../contexts'

export const metadata: Metadata = {
	title: 'Gestor de Presupuesto',
	description: 'Sistema de gestión financiera personal',
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
	// Obtener la sesión actual para el tour (shared with the root layout and the page)
	const session = await getServerSession()
	const user = session?.user

	return (
		<ScopedIntlMessages scope='app'>
			<SettingsProvider>
				<GlobalActionProvider>
					<NotificationProvider>
						<Sidebar>
							<PageTransition>
								{user && <DemoTour user={user} />}
								{children}
							</PageTransition>
						</Sidebar>
					</NotificationProvider>
				</GlobalActionProvider>
			</SettingsProvider>
		</ScopedIntlMessages>
	)
}
