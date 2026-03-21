import type { Metadata } from 'next'
import '../../styles/globals.css'
import PageTransition from '@/components/common/page-transition'
import { Sidebar } from '@/components/common/sidebar'
import { Toaster } from '@/components/ui/sonner'
import { GlobalActionProvider } from '@/contexts/GlobalActionContext'
import { NotificationProvider } from '@/contexts/NotificationContext'
import { SettingsProvider } from '../../contexts'

export const metadata: Metadata = {
	title: 'Admin - Gestor de Presupuesto',
	description: 'Backoffice de administración',
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
	return (
		<SettingsProvider>
			<GlobalActionProvider>
				<NotificationProvider>
					<Sidebar>
						<PageTransition>{children}</PageTransition>
					</Sidebar>
					<Toaster />
				</NotificationProvider>
			</GlobalActionProvider>
		</SettingsProvider>
	)
}
