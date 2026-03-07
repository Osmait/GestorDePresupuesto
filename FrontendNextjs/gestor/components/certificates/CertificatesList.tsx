'use client'

import { CertificateCard } from './CertificateCard'
import { Certificate } from '@/types/certificate'

interface CertificatesListProps {
	certificates: Certificate[]
	onEdit: (certificate: Certificate) => void
	onDelete: (id: string) => void
	onViewHistory: (id: string) => void
	onSimulate: (certificate: Certificate) => void
	selectedId?: string
}

export function CertificatesList({ certificates, onEdit, onDelete, onViewHistory, onSimulate, selectedId }: CertificatesListProps) {
	if (certificates.length === 0) {
		return (
			<div className="text-center py-12">
				<p className="text-muted-foreground">No certificates found. Create your first certificate to get started.</p>
			</div>
		)
	}

	return (
		<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
			{certificates.map((certificate) => (
				<div
					key={certificate.id}
					id={`certificate-card-${certificate.id}`}
					className={selectedId === certificate.id ? 'rounded-xl ring-2 ring-primary/70 ring-offset-2 ring-offset-background' : ''}
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
