import type { Metadata } from 'next'
import '../../styles/globals.css'
import { DemoTour } from '@/components/common/DemoTour'
import PageTransition from '@/components/common/page-transition'
import { Sidebar } from '@/components/common/sidebar'
import { Toaster } from '@/components/ui/sonner'
import { GlobalActionProvider } from '@/contexts/GlobalActionContext'
import { NotificationProvider } from '@/contexts/NotificationContext'
import { SettingsProvider } from '../../contexts'

export const metadata: Metadata = {
	title: 'Gestor de Presupuesto',
	description: 'Sistema de gestión financiera personal',
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
	// Obtener la sesión actual para el tour
	const { auth } = await import('@/auth')
	const session = await auth()
	const user = session?.user

	return (
		<SettingsProvider>
			<GlobalActionProvider>
				<NotificationProvider>
					<Sidebar>
						<PageTransition>
							{user && <DemoTour user={user} />}
							{children}
						</PageTransition>
					</Sidebar>
					<Toaster />
				</NotificationProvider>
			</GlobalActionProvider>
		</SettingsProvider>
	)
}
