'use client'

import { Button } from '@/components/ui/button'
import { Plus, Calculator } from 'lucide-react'

interface CertificateActionsProps {
	onAddNew: () => void
	onOpenSimulator: () => void
}

export function CertificateActions({ onAddNew, onOpenSimulator }: CertificateActionsProps) {
	return (
		<div className="flex justify-end gap-2">
			<Button variant="outline" onClick={onOpenSimulator}>
				<Calculator className="h-4 w-4 mr-2" />
				Simulator
			</Button>
			<Button onClick={onAddNew}>
				<Plus className="h-4 w-4 mr-2" />
				New Certificate
			</Button>
		</div>
	)
}
