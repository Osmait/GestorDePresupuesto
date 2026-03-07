import type { Metadata } from 'next'
import '../../styles/globals.css'

export const metadata: Metadata = {
	title: 'Iniciar Sesión - SBFinance',
	description: 'Accede a tu cuenta de gestión financiera personal',
}

export default function LoginLayout({
	children,
}: {
	children: React.ReactNode
}) {
	return (
		<>
			{children}
		</>
	)
}
