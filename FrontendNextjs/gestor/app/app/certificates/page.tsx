'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { CertificateProvider, useCertificates } from '@/components/certificates/CertificateContext'
import { CertificateSummaryCard } from '@/components/certificates/CertificateSummaryCard'
import { CertificatesList } from '@/components/certificates/CertificatesList'
import { CertificateActions } from '@/components/certificates/CertificateActions'
import { CertificateFormModal } from '@/components/certificates/CertificateFormModal'
import { CertificatePaymentHistory } from '@/components/certificates/CertificatePaymentHistory'
import { PaymentSimulator } from '@/components/certificates/PaymentSimulator'
import { CertificatesPageSkeleton } from '@/components/certificates/CertificatesPageSkeleton'
import { Certificate, CreateCertificateDTO, UpdateCertificateDTO } from '@/types/certificate'
import { useGetAccounts } from '@/hooks/queries/useAccountsQuery'
import { useFeatureFlags } from '@/hooks/useFeatureFlags'
import { AlertCircle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

function CertificatesContent() {
	const { certificates, summary, isLoading, error, createCertificate, updateCertificate, deleteCertificate } = useCertificates()
	const { data: accountsData } = useGetAccounts()
	const [isFormOpen, setIsFormOpen] = useState(false)
	const [editingCertificate, setEditingCertificate] = useState<Certificate | null>(null)
	const [historyCertificateId, setHistoryCertificateId] = useState<string | null>(null)
	const [isSimulatorOpen, setIsSimulatorOpen] = useState(false)
	const [simulatorCertificate, setSimulatorCertificate] = useState<Certificate | null>(null)
	const router = useRouter()
	const pathname = usePathname()
	const searchParams = useSearchParams()
	const selectedCertificateId = searchParams.get('selected') || ''
	const openParam = searchParams.get('open') || ''

	const accounts = accountsData?.map((a: any) => ({
		id: a.id,
		name: a.name,
		bank: a.bank,
	})) || []

	const handleAddNew = () => {
		setEditingCertificate(null)
		setIsFormOpen(true)
	}

	const handleEdit = (certificate: Certificate) => {
		setEditingCertificate(certificate)
		setIsFormOpen(true)
	}

	const handleDelete = async (id: string) => {
		if (confirm('Are you sure you want to cancel this certificate?')) {
			await deleteCertificate(id)
		}
	}

	const handleViewHistory = (id: string) => {
		setHistoryCertificateId(id)
	}

	const handleSimulate = (certificate: Certificate) => {
		setSimulatorCertificate(certificate)
		setIsSimulatorOpen(true)
	}

	const handleOpenSimulator = () => {
		setSimulatorCertificate(null)
		setIsSimulatorOpen(true)
	}

	useEffect(() => {
		if (!selectedCertificateId) return
		const element = document.getElementById(`certificate-card-${selectedCertificateId}`)
		if (!element) return
		element.scrollIntoView({ behavior: 'smooth', block: 'center' })
	}, [selectedCertificateId, certificates])

	useEffect(() => {
		if (!selectedCertificateId || openParam !== 'history') return
		setHistoryCertificateId(selectedCertificateId)
	}, [selectedCertificateId, openParam])

	const handleHistoryOpenChange = (open: boolean) => {
		if (open) return

		setHistoryCertificateId(null)
		const params = new URLSearchParams(searchParams.toString())
		if (params.has('open') || params.has('selected')) {
			params.delete('open')
			params.delete('selected')
			router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname, { scroll: false })
		}
	}

	const handleSimulateFromForm = (data: { capital: number; rate: number; taxRate: number; interestType: string; reinvestInterest: boolean }) => {
		const tempCertificate: Certificate = {
			id: 'temp',
			bank: 'Simulation',
			base_capital: data.capital,
			interest_type: data.interestType as 'simple' | 'compound',
			current_interest_rate: data.rate,
			current_tax_rate: data.taxRate,
			cut_day: 19,
			reinvest_interest: data.reinvestInterest,
			status: 'active',
			currency: 'DOP',
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
			effective_capital: data.capital,
		}
		setSimulatorCertificate(tempCertificate)
		setIsSimulatorOpen(true)
	}

	const handleFormSubmit = async (data: CreateCertificateDTO | UpdateCertificateDTO) => {
		if (editingCertificate) {
			await updateCertificate(editingCertificate.id, data as UpdateCertificateDTO)
		} else {
			await createCertificate(data as CreateCertificateDTO)
		}
	}

	if (isLoading) {
		return <CertificatesPageSkeleton />
	}

	if (error) {
		return (
			<div className="container mx-auto p-6">
				<Alert variant="destructive">
					<AlertCircle className="h-4 w-4" />
					<AlertTitle>Error</AlertTitle>
					<AlertDescription>Failed to load certificates. Please try again.</AlertDescription>
				</Alert>
			</div>
		)
	}

	return (
		<div className="container mx-auto p-6 space-y-6">
			<div className="flex justify-between items-center">
				<div>
					<h1 className="text-3xl font-bold">Certificates</h1>
					<p className="text-muted-foreground">Manage your financial certificates and track interest payments</p>
				</div>
			</div>

			<CertificateSummaryCard summary={summary} />

			<CertificateActions onAddNew={handleAddNew} onOpenSimulator={handleOpenSimulator} />

			<CertificatesList
				certificates={certificates || []}
				onEdit={handleEdit}
				onDelete={handleDelete}
				onViewHistory={handleViewHistory}
				onSimulate={handleSimulate}
				selectedId={selectedCertificateId}
			/>

			<CertificateFormModal
				open={isFormOpen}
				onOpenChange={setIsFormOpen}
				certificate={editingCertificate}
				accounts={accounts}
				onSubmit={handleFormSubmit}
				onSimulate={handleSimulateFromForm}
			/>

			<CertificatePaymentHistory
				certificateId={historyCertificateId}
				open={!!historyCertificateId}
				onOpenChange={handleHistoryOpenChange}
			/>

			<PaymentSimulator
				open={isSimulatorOpen}
				onOpenChange={setIsSimulatorOpen}
				certificate={simulatorCertificate}
			/>
		</div>
	)
}

export default function CertificatesPage() {
	const { status } = useSession()
	const router = useRouter()
	const { isEnabled, isLoading: isFeatureFlagsLoading } = useFeatureFlags()
	const isCertificatesModuleEnabled = isEnabled('module_certificates')

	useEffect(() => {
		if (status === 'unauthenticated') {
			router.push('/login')
		}
	}, [status, router])

	if (status === 'loading' || isFeatureFlagsLoading) {
		return <CertificatesPageSkeleton />
	}

	if (!isCertificatesModuleEnabled) {
		return (
			<div className="container mx-auto p-6 space-y-4">
				<h1 className="text-2xl font-semibold">Certificates</h1>
				<p className="text-muted-foreground">This module is currently disabled for your account.</p>
				<Button variant="outline" onClick={() => router.push('/app')}>Go to dashboard</Button>
			</div>
		)
	}

	return (
		<CertificateProvider>
			<CertificatesContent />
		</CertificateProvider>
	)
}
