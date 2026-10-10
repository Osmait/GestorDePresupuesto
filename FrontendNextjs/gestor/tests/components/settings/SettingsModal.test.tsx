import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { SettingsModal } from '@/components/settings/SettingsModal'
import { renderWithIntl } from '@/tests/utils/intl'

beforeAll(() => {
	HTMLElement.prototype.hasPointerCapture = vi.fn()
	HTMLElement.prototype.scrollIntoView = vi.fn()
	global.ResizeObserver = class ResizeObserver {
		observe() {}
		unobserve() {}
		disconnect() {}
	} as unknown as typeof globalThis.ResizeObserver
})

vi.mock('@/contexts', () => ({
	useSettings: () => ({
		sidebarHoverEnabled: false,
		setSidebarHoverEnabled: vi.fn(),
		notifications: { email: true, push: false, sms: false },
		setNotifications: vi.fn(),
		currency: 'DOP',
	}),
}))

vi.mock('@/components/common/ToggleMode', () => ({
	ModeToggle: () => <div data-testid='mode-toggle' />,
}))

vi.mock('@/components/settings/APIKeysSection', () => ({
	APIKeysSection: () => <div data-testid='api-keys-section' />,
}))

vi.mock('@/components/settings/PasskeyManager', () => ({
	PasskeyManager: () => <div data-testid='passkey-manager' />,
}))

describe('SettingsModal', () => {
	it('renders the general tab in Spanish', () => {
		renderWithIntl(<SettingsModal open onOpenChange={vi.fn()} />, { locale: 'es' })

		expect(screen.getByRole('heading', { name: 'Configuración' })).toBeInTheDocument()
		expect(screen.getByText('Apariencia')).toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument()
	})

	it('renders every section in English without Spanish leftovers', async () => {
		const user = userEvent.setup()
		renderWithIntl(<SettingsModal open onOpenChange={vi.fn()} />, { locale: 'en' })

		expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
		expect(screen.getByText('Appearance')).toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()

		const spanish = /Apariencia|Editar|Cambiar|Seguridad|Notificaciones|Gestionar|Exportar|Eliminar|Configuración/
		expect(screen.getByRole('dialog')).not.toHaveTextContent(spanish)

		for (const tab of ['Security', 'Notifications', 'Data & Privacy']) {
			await user.click(screen.getByRole('button', { name: tab }))
			expect(screen.getByRole('dialog')).not.toHaveTextContent(spanish)
		}
		expect(screen.getByRole('button', { name: 'Delete Account' })).toBeInTheDocument()
	})
})
