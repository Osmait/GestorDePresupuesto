import type { Metadata } from 'next'
import '../../styles/globals.css'

export const metadata: Metadata = {
	title: 'Crear Cuenta - SBFinance',
	description: 'Crea tu cuenta de gestión financiera personal',
}

export default function RegisterLayout({
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
