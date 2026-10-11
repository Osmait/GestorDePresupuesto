'use client'

import { Calculator, Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'

interface CertificateActionsProps {
	onAddNew: () => void
	onOpenSimulator: () => void
}

/** Page-level actions for the certificates `PageHeader` (simulator, then the primary create button). */
export function CertificateActions({ onAddNew, onOpenSimulator }: CertificateActionsProps) {
	const t = useTranslations('certificates.actions')

	return (
		<>
			<Button variant='outline' onClick={onOpenSimulator}>
				<Calculator className='mr-2 h-4 w-4' aria-hidden='true' />
				{t('simulator')}
			</Button>
			<Button onClick={onAddNew}>
				<Plus className='mr-2 h-4 w-4' aria-hidden='true' />
				{t('newCertificate')}
			</Button>
		</>
	)
}
