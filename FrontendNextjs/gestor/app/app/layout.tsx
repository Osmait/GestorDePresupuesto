import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import '../../styles/globals.css'
import { ThemeProvider } from '@/components/common/theme-provider'
import { SettingsProvider } from '../../contexts'
import { Sidebar } from '@/components/common/sidebar'
import { cn } from '../../lib/utils'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
	title: 'Gestor de Presupuesto',
	description: 'Sistema de gestión financiera personal',
}

export default function RootLayout({
	children,
}: {
	children: React.ReactNode
}) {
	return (
		<html lang="es">
			<body className={cn(inter.className, 'antialiased')}>
				<ThemeProvider
					attribute="class"
					defaultTheme="system"
					enableSystem
					disableTransitionOnChange
				>
					<SettingsProvider>
						<Sidebar>
							{children}
						</Sidebar>
					</SettingsProvider>
				</ThemeProvider>
			</body>
		</html>
	)
}
