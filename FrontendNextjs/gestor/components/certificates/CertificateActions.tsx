'use client'

import { Calculator, Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'

interface CertificateActionsProps {
	onAddNew: () => void
	onOpenSimulator: () => void
}

export function CertificateActions({ onAddNew, onOpenSimulator }: CertificateActionsProps) {
	const t = useTranslations('certificates.actions')

	return (
		<div className='flex flex-wrap gap-2 sm:justify-end'>
			<Button variant='outline' onClick={onOpenSimulator}>
				<Calculator className='h-4 w-4 mr-2' />
				{t('simulator')}
			</Button>
			<Button onClick={onAddNew}>
				<Plus className='h-4 w-4 mr-2' />
				{t('newCertificate')}
			</Button>
		</div>
	)
}
