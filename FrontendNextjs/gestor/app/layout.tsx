import type { Metadata } from 'next'
import { Inter, Plus_Jakarta_Sans } from 'next/font/google'
import '../styles/globals.css'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import { AuthSessionProvider } from '@/components/auth/session-provider'
import { ProgressBarProvider } from '@/components/common/progress-bar-provider'
import { ReactQueryProvider } from '@/components/common/react-query-provider'
import { ThemeProvider } from '@/components/common/theme-provider'
import { WebVitalsReporter } from '@/components/telemetry/web-vitals-reporter'
import { Toaster } from '@/components/ui/sonner'
import { CLIENT_NAMESPACES, pickMessages } from '@/lib/i18n/client-messages'
import { getServerSession } from '@/lib/server/session'
import { parseSampleRate } from '@/lib/telemetry/web-vitals'
import { cn } from '@/lib/utils'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const plusJakarta = Plus_Jakarta_Sans({
	subsets: ['latin'],
	variable: '--font-plus-jakarta',
})

export const metadata: Metadata = {
	title: 'SBFinance',
	description:
		'La plataforma más completa para gestionar tus finanzas personales. Controla gastos, crea presupuestos inteligentes y alcanza tus metas financieras.',
	keywords: ['finanzas personales', 'presupuesto', 'gastos', 'ahorro', 'inversiones', 'criptomonedas'],
	authors: [{ name: 'SBFinance Team' }],
	creator: 'SBFinance',
	publisher: 'SBFinance',
	formatDetection: {
		email: false,
		address: false,
		telephone: false,
	},
	openGraph: {
		type: 'website',
		siteName: 'SBFinance',
		title: 'SBFinance',
		description: 'La plataforma más completa para gestionar tus finanzas personales',
		images: [
			{
				url: '/og-image.jpg',
				width: 1200,
				height: 630,
				alt: 'SBFinance - Gestor de Presupuesto Personal',
			},
		],
	},
	twitter: {
		card: 'summary_large_image',
		title: 'SBFinance',
		description: 'La plataforma más completa para gestionar tus finanzas personales',
		images: ['/og-image.jpg'],
	},
	icons: {
		icon: [
			{ url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
			{ url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
		],
		shortcut: '/favicon-32x32.png',
		apple: '/apple-touch-icon.png',
	},
	manifest: '/site.webmanifest',
}

/**
 * Vercel Analytics/Speed Insights load scripts from `/_vercel/*`, which only exist
 * on Vercel deployments: elsewhere (Docker, `next start`, dev) they 404 on every page.
 * `VERCEL` is set by the platform; NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS forces it on.
 */
const vercelAnalyticsEnabled = process.env.VERCEL === '1' || process.env.NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS === 'true'

export default async function RootLayout({ children }: { children: React.ReactNode }) {
	const locale = await getLocale()
	const messages = await getMessages()
	// Hydrates the client session without a /api/auth/session round trip on load.
	const session = await getServerSession()
	// Off by default; read at request time so it can be changed without a rebuild.
	const webVitalsSampleRate = parseSampleRate(process.env.WEB_VITALS_SAMPLE_RATE)

	return (
		<html lang={locale} suppressHydrationWarning>
			<body className={cn(inter.variable, plusJakarta.variable, 'font-sans antialiased')}>
				<AuthSessionProvider session={session}>
					<ThemeProvider attribute='class' defaultTheme='system' enableSystem disableTransitionOnChange>
						{/* Only what client components need; route segments add theirs (ScopedIntlMessages). */}
						<NextIntlClientProvider messages={pickMessages(messages, CLIENT_NAMESPACES.root)}>
							<ProgressBarProvider>
								<ReactQueryProvider>{children}</ReactQueryProvider>
							</ProgressBarProvider>
						</NextIntlClientProvider>
					</ThemeProvider>
				</AuthSessionProvider>
				<Toaster />
				{webVitalsSampleRate > 0 && <WebVitalsReporter sampleRate={webVitalsSampleRate} />}
				{vercelAnalyticsEnabled && (
					<>
						<Analytics />
						<SpeedInsights />
					</>
				)}
			</body>
		</html>
	)
}
