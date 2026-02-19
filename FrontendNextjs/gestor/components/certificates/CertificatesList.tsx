'use client'

import { CertificateCard } from './CertificateCard'
import { Certificate } from '@/types/certificate'

interface CertificatesListProps {
	certificates: Certificate[]
	onEdit: (certificate: Certificate) => void
	onDelete: (id: string) => void
	onViewHistory: (id: string) => void
	onSimulate: (certificate: Certificate) => void
}

export function CertificatesList({ certificates, onEdit, onDelete, onViewHistory, onSimulate }: CertificatesListProps) {
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
				<CertificateCard
					key={certificate.id}
					certificate={certificate}
					onEdit={onEdit}
					onDelete={onDelete}
					onViewHistory={onViewHistory}
					onSimulate={onSimulate}
				/>
			))}
		</div>
	)
}
