import { BaseRepository } from '@/lib/base-repository'
import {
	Certificate,
	CertificateWithHistory,
	CertificateSummary,
	CreateCertificateDTO,
	UpdateCertificateDTO,
	UpdateCertificatePaymentDTO,
	SimulatePaymentDTO,
	SimulationResult,
} from '@/types/certificate'

export class CertificateRepository extends BaseRepository {
	async findAll(): Promise<Certificate[]> {
		return this.get<Certificate[]>('/certificate')
	}

	async findById(id: string): Promise<CertificateWithHistory> {
		return this.get<CertificateWithHistory>(`/certificate/${id}`)
	}

	async create(data: CreateCertificateDTO): Promise<void> {
		return this.post('/certificate', data)
	}

	async update(id: string, data: UpdateCertificateDTO): Promise<void> {
		return this.put(`/certificate/${id}`, data)
	}

	async delete(id: string): Promise<void> {
		return this.deleteRequest(`/certificate/${id}`)
	}

	async updatePayment(paymentId: string, data: UpdateCertificatePaymentDTO): Promise<void> {
		return this.put(`/certificate/payments/${paymentId}`, data)
	}

	async simulate(id: string, data: SimulatePaymentDTO): Promise<SimulationResult> {
		const result = await this.post<SimulationResult>(`/certificate/${id}/simulate`, data)
		return result as SimulationResult
	}

	async getSummary(): Promise<CertificateSummary> {
		return this.get<CertificateSummary>('/certificate/summary')
	}
}

let certificateRepositoryInstance: CertificateRepository | null = null

export const getCertificateRepository = async () => {
	if (!certificateRepositoryInstance) {
		certificateRepositoryInstance = new CertificateRepository()
	}
	return certificateRepositoryInstance
}

export const certificateRepository = new CertificateRepository()
