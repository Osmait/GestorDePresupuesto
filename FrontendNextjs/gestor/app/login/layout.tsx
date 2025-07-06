import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import '../../styles/globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { cn } from '@/lib/utils'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
	title: 'Iniciar Sesión - FinanceApp',
	description: 'Accede a tu cuenta de gestión financiera personal',
}

export default function LoginLayout({
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
					{children}
				</ThemeProvider>
			</body>
		</html>
	)
}
