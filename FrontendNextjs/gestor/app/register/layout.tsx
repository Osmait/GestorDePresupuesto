import type { Metadata } from 'next'
import '../../styles/globals.css'
import { ScopedIntlMessages } from '@/components/i18n/ScopedIntlMessages'

export const metadata: Metadata = {
	title: 'Crear Cuenta - SBFinance',
	description: 'Crea tu cuenta de gestión financiera personal',
}

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
	return <ScopedIntlMessages scope='auth'>{children}</ScopedIntlMessages>
}
