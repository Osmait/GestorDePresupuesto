'use client'

import { Landmark, Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Certificate } from '@/types/certificate'
import { CertificateCard } from './CertificateCard'

interface CertificatesListProps {
	certificates: Certificate[]
	onEdit: (certificate: Certificate) => void
	onDelete: (id: string) => void
	onViewHistory: (id: string) => void
	onSimulate: (certificate: Certificate) => void
	selectedId?: string
	/** Opens the create form from the empty state. */
	onAddNew?: () => void
}

export function CertificatesList({
	certificates,
	onEdit,
	onDelete,
	onViewHistory,
	onSimulate,
	selectedId,
	onAddNew,
}: CertificatesListProps) {
	const t = useTranslations('certificates')

	if (certificates.length === 0) {
		return (
			<EmptyState
				icon={Landmark}
				title={t('emptyTitle')}
				description={t('emptyDescription')}
				action={
					onAddNew ? (
						<Button onClick={onAddNew}>
							<Plus className='mr-2 h-4 w-4' aria-hidden='true' />
							{t('actions.newCertificate')}
						</Button>
					) : undefined
				}
			/>
		)
	}

	return (
		<div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
			{certificates.map((certificate) => (
				<div
					key={certificate.id}
					id={`certificate-card-${certificate.id}`}
					className={
						selectedId === certificate.id
							? 'rounded-lg ring-2 ring-primary/70 ring-offset-2 ring-offset-background'
							: ''
					}
				>
					<CertificateCard
						certificate={certificate}
						onEdit={onEdit}
						onDelete={onDelete}
						onViewHistory={onViewHistory}
						onSimulate={onSimulate}
					/>
				</div>
			))}
		</div>
	)
}
