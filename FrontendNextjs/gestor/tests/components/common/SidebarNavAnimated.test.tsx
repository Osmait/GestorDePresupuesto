import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { AnimatedSidebarNav } from '@/components/common/sidebar-nav-animated'

vi.mock('next/navigation', () => ({
	usePathname: () => '/app/accounts',
	useRouter: () => ({ prefetch: vi.fn() }),
}))

const items = [
	{ title: 'Dashboard', href: '/app', icon: () => null, description: 'd' },
	{ title: 'Accounts', href: '/app/accounts', icon: () => null, description: 'd' },
]

describe('AnimatedSidebarNav', () => {
	it('marks only the active link with aria-current="page"', () => {
		render(<AnimatedSidebarNav items={items} isExpanded />)

		expect(screen.getByRole('link', { name: 'Accounts' })).toHaveAttribute('aria-current', 'page')
		expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current')
	})

	it('keeps the link name when collapsed', () => {
		render(<AnimatedSidebarNav items={items} isExpanded={false} />)
		expect(screen.getByRole('link', { name: 'Accounts' })).toBeInTheDocument()
	})
})
