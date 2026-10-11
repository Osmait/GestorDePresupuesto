import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CertificateCard } from '@/components/certificates/CertificateCard'
import { renderWithIntl } from '@/tests/utils/intl'
import type { Certificate } from '@/types/certificate'

function makeCertificate(overrides: Partial<Certificate> = {}): Certificate {
	return {
		id: 'cert-1',
		bank: 'Banco Popular',
		base_capital: 100000,
		interest_type: 'compound',
		current_interest_rate: 8.5,
		current_tax_rate: 10,
		cut_day: 19,
		reinvest_interest: true,
		status: 'active',
		currency: 'USD',
		created_at: '2024-01-01T00:00:00Z',
		updated_at: '2024-01-01T00:00:00Z',
		effective_capital: 100000,
		...overrides,
	}
}

function renderCard(certificate: Certificate, locale: 'en' | 'es' = 'en') {
	const handlers = { onEdit: vi.fn(), onDelete: vi.fn(), onViewHistory: vi.fn(), onSimulate: vi.fn() }
	renderWithIntl(<CertificateCard certificate={certificate} {...handlers} />, { locale })
	return handlers
}

describe('CertificateCard', () => {
	it('renders translated labels, status and interest type in English', () => {
		renderCard(makeCertificate())

		expect(screen.getByText('Active')).toBeInTheDocument()
		expect(screen.getByText('Compound')).toBeInTheDocument()
		expect(screen.getByText('Effective capital')).toBeInTheDocument()
		expect(screen.getByText('Day 19')).toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Actions for Banco Popular' })).toBeInTheDocument()
		expect(screen.getByText('US$100,000.00')).toBeInTheDocument()
	})

	it('offers history, simulate, edit and cancel in the actions menu (es)', async () => {
		const user = userEvent.setup()
		const certificate = makeCertificate({ status: 'matured', interest_type: 'simple' })
		const handlers = renderCard(certificate, 'es')

		expect(screen.getByText('Vencido')).toBeInTheDocument()
		expect(screen.getByText('Simple')).toBeInTheDocument()
		expect(screen.getByText('Capital efectivo')).toBeInTheDocument()
		expect(screen.getByText('Día 19')).toBeInTheDocument()

		await user.click(screen.getByRole('button', { name: 'Acciones de Banco Popular' }))
		await user.click(await screen.findByRole('menuitem', { name: 'Historial' }))
		expect(handlers.onViewHistory).toHaveBeenCalledWith('cert-1')

		await user.click(screen.getByRole('button', { name: 'Acciones de Banco Popular' }))
		await user.click(await screen.findByRole('menuitem', { name: 'Simular' }))
		expect(handlers.onSimulate).toHaveBeenCalledWith(certificate)
	})

	it('shows Activo for active certificates in es and wires edit and cancel', async () => {
		const user = userEvent.setup()
		const certificate = makeCertificate()
		const handlers = renderCard(certificate, 'es')

		expect(screen.getByText('Activo')).toBeInTheDocument()
		await user.click(screen.getByRole('button', { name: 'Acciones de Banco Popular' }))
		await user.click(await screen.findByRole('menuitem', { name: 'Editar' }))
		expect(handlers.onEdit).toHaveBeenCalledWith(certificate)

		await user.click(screen.getByRole('button', { name: 'Acciones de Banco Popular' }))
		await user.click(await screen.findByRole('menuitem', { name: 'Cancelar certificado' }))
		expect(handlers.onDelete).toHaveBeenCalledWith('cert-1')
	})

	it('disables edit and cancel for a cancelled certificate', async () => {
		const user = userEvent.setup()
		renderCard(makeCertificate({ status: 'cancelled' }))

		await user.click(screen.getByRole('button', { name: 'Actions for Banco Popular' }))
		expect(await screen.findByRole('menuitem', { name: 'Edit' })).toHaveAttribute('data-disabled')
		expect(screen.getByRole('menuitem', { name: 'Cancel certificate' })).toHaveAttribute('data-disabled')
		expect(screen.getByRole('menuitem', { name: 'History' })).not.toHaveAttribute('data-disabled')
	})
})
