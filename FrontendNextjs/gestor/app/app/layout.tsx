import type { Metadata } from 'next'
import '../../styles/globals.css'
import { SettingsProvider } from '../../contexts'
import { Sidebar } from '@/components/common/sidebar'
import { GlobalActionProvider } from '@/contexts/GlobalActionContext'
import { NotificationProvider } from '@/contexts/NotificationContext'
import { Toaster } from '@/components/ui/sonner'
import PageTransition from '@/components/common/page-transition'
import { DemoTour } from '@/components/common/DemoTour'

export const metadata: Metadata = {
	title: 'Gestor de Presupuesto',
	description: 'Sistema de gestión financiera personal',
}

export default async function DashboardLayout({
	children,
}: {
	children: React.ReactNode
}) {
	// Obtener la sesión actual para el tour
	const { getServerSession } = await import("next-auth");
	const { authOptions } = await import("@/auth");
	const session = await getServerSession(authOptions);
	const user = session?.user;

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
