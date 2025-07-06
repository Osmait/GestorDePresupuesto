import type { Metadata } from 'next'
import { Inter, Plus_Jakarta_Sans } from 'next/font/google'
import '../styles/globals.css'
import { ThemeProvider } from '@/components/common/theme-provider'
import { cn } from '@/lib/utils'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const plusJakarta = Plus_Jakarta_Sans({ 
	subsets: ['latin'], 
	variable: '--font-plus-jakarta' 
})

export const metadata: Metadata = {
	title: 'FinanceApp - Gestor de Presupuesto Personal',
	description: 'La plataforma más completa para gestionar tus finanzas personales. Controla gastos, crea presupuestos inteligentes y alcanza tus metas financieras.',
	keywords: ['finanzas personales', 'presupuesto', 'gastos', 'ahorro', 'inversiones', 'criptomonedas'],
	authors: [{ name: 'FinanceApp Team' }],
	creator: 'FinanceApp',
	publisher: 'FinanceApp',
	formatDetection: {
		email: false,
		address: false,
		telephone: false,
	},
	openGraph: {
		type: 'website',
		siteName: 'FinanceApp',
		title: 'FinanceApp - Gestor de Presupuesto Personal',
		description: 'La plataforma más completa para gestionar tus finanzas personales',
		images: [
			{
				url: '/og-image.jpg',
				width: 1200,
				height: 630,
				alt: 'FinanceApp - Gestor de Presupuesto Personal',
			},
		],
	},
	twitter: {
		card: 'summary_large_image',
		title: 'FinanceApp - Gestor de Presupuesto Personal',
		description: 'La plataforma más completa para gestionar tus finanzas personales',
		images: ['/og-image.jpg'],
	},
	icons: {
		icon: '/favicon.ico',
		shortcut: '/favicon-16x16.png',
		apple: '/apple-touch-icon.png',
	},
	manifest: '/site.webmanifest',
}

export default function RootLayout({
	children,
}: {
	children: React.ReactNode
}) {
	return (
		<html lang="es" suppressHydrationWarning>
			<body className={cn(
				inter.variable,
				plusJakarta.variable,
				'font-sans antialiased'
			)}>
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