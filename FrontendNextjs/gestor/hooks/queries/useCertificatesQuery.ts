'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getCertificateRepository } from '@/app/repository/certificateRepository'
import {
	CertificateSummary,
	CertificateWithHistory,
	CreateCertificateDTO,
	SimulatePaymentDTO,
	SimulationResult,
	UpdateCertificateDTO,
	UpdateCertificatePaymentDTO,
} from '@/types/certificate'

export const CERTIFICATE_KEYS = {
	all: ['certificates'] as const,
	lists: () => [...CERTIFICATE_KEYS.all, 'list'] as const,
	detail: (id: string) => [...CERTIFICATE_KEYS.all, 'detail', id] as const,
	summary: () => [...CERTIFICATE_KEYS.all, 'summary'] as const,
}

export function useGetCertificates() {
	return useQuery({
		queryKey: CERTIFICATE_KEYS.lists(),
		queryFn: async () => {
			const repo = await getCertificateRepository()
			return repo.findAll()
		},
	})
}

export function useGetCertificate(id: string) {
	return useQuery({
		queryKey: CERTIFICATE_KEYS.detail(id),
		queryFn: async (): Promise<CertificateWithHistory> => {
			const repo = await getCertificateRepository()
			return repo.findById(id)
		},
		enabled: !!id,
	})
}

export function useGetCertificateSummary() {
	return useQuery({
		queryKey: CERTIFICATE_KEYS.summary(),
		queryFn: async (): Promise<CertificateSummary> => {
			const repo = await getCertificateRepository()
			return repo.getSummary()
		},
	})
}

export function useCreateCertificateMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (data: CreateCertificateDTO) => {
			const repo = await getCertificateRepository()
			return repo.create(data)
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: CERTIFICATE_KEYS.lists() })
			queryClient.invalidateQueries({ queryKey: CERTIFICATE_KEYS.summary() })
		},
	})
}

export function useUpdateCertificateMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async ({ id, data }: { id: string; data: UpdateCertificateDTO }) => {
			const repo = await getCertificateRepository()
			return repo.update(id, data)
		},
		onSuccess: (_, { id }) => {
			queryClient.invalidateQueries({ queryKey: CERTIFICATE_KEYS.lists() })
			queryClient.invalidateQueries({ queryKey: CERTIFICATE_KEYS.detail(id) })
			queryClient.invalidateQueries({ queryKey: CERTIFICATE_KEYS.summary() })
		},
	})
}

export function useDeleteCertificateMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (id: string) => {
			const repo = await getCertificateRepository()
			return repo.delete(id)
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: CERTIFICATE_KEYS.lists() })
			queryClient.invalidateQueries({ queryKey: CERTIFICATE_KEYS.summary() })
		},
	})
}

export function useUpdateCertificatePaymentMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async ({ paymentId, data }: { paymentId: string; data: UpdateCertificatePaymentDTO }) => {
			const repo = await getCertificateRepository()
			return repo.updatePayment(paymentId, data)
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: CERTIFICATE_KEYS.all })
		},
	})
}

export function useSimulateCertificateMutation() {
	return useMutation({
		mutationFn: async ({ id, data }: { id: string; data: SimulatePaymentDTO }): Promise<SimulationResult> => {
			const repo = await getCertificateRepository()
			return repo.simulate(id, data)
		},
	})
}
