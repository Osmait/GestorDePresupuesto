'use client'

import { createContext, useContext, ReactNode, useCallback } from 'react'
import {
	Certificate,
	CertificateSummary,
	CreateCertificateDTO,
	UpdateCertificateDTO,
	SimulatePaymentDTO,
	SimulationResult,
} from '@/types/certificate'
import {
	useGetCertificates,
	useGetCertificateSummary,
	useCreateCertificateMutation,
	useUpdateCertificateMutation,
	useDeleteCertificateMutation,
	useSimulateCertificateMutation,
} from '@/hooks/queries/useCertificatesQuery'

interface CertificateContextType {
	certificates: Certificate[] | undefined
	summary: CertificateSummary | undefined
	isLoading: boolean
	error: Error | null
	createCertificate: (data: CreateCertificateDTO) => Promise<void>
	updateCertificate: (id: string, data: UpdateCertificateDTO) => Promise<void>
	deleteCertificate: (id: string) => Promise<void>
	simulate: (id: string, data: SimulatePaymentDTO) => Promise<SimulationResult>
	refetch: () => Promise<void>
}

const CertificateContext = createContext<CertificateContextType | undefined>(undefined)

export function CertificateProvider({ children }: { children: ReactNode }) {
	const { data: certificates, isLoading: isLoadingList, error: listError, refetch: refetchList } = useGetCertificates()
	const { data: summary, isLoading: isLoadingSummary } = useGetCertificateSummary()
	const createMutation = useCreateCertificateMutation()
	const updateMutation = useUpdateCertificateMutation()
	const deleteMutation = useDeleteCertificateMutation()
	const simulateMutation = useSimulateCertificateMutation()

	const createCertificate = useCallback(
		async (data: CreateCertificateDTO) => {
			await createMutation.mutateAsync(data)
		},
		[createMutation]
	)

	const updateCertificate = useCallback(
		async (id: string, data: UpdateCertificateDTO) => {
			await updateMutation.mutateAsync({ id, data })
		},
		[updateMutation]
	)

	const deleteCertificate = useCallback(
		async (id: string) => {
			await deleteMutation.mutateAsync(id)
		},
		[deleteMutation]
	)

	const simulate = useCallback(
		async (id: string, data: SimulatePaymentDTO): Promise<SimulationResult> => {
			return simulateMutation.mutateAsync({ id, data })
		},
		[simulateMutation]
	)

	const refetch = useCallback(async () => {
		await refetchList()
	}, [refetchList])

	const value: CertificateContextType = {
		certificates,
		summary,
		isLoading: isLoadingList || isLoadingSummary,
		error: listError || null,
		createCertificate,
		updateCertificate,
		deleteCertificate,
		simulate,
		refetch,
	}

	return <CertificateContext.Provider value={value}>{children}</CertificateContext.Provider>
}

export function useCertificates() {
	const context = useContext(CertificateContext)
	if (context === undefined) {
		throw new Error('useCertificates must be used within a CertificateProvider')
	}
	return context
}
