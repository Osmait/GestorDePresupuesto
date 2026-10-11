import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { Sidebar } from '@/components/common/sidebar'

// Mock hooks
vi.mock('next/navigation', () => ({
	usePathname: () => '/app',
}))

vi.mock('next-intl', () => ({
	useTranslations: () => (key: string) => key,
}))

vi.mock('@/hooks/use-nav-items', () => ({
	useNavItems: () => ({
		navItems: [
			{ title: 'Dashboard', href: '/app', icon: () => null, description: 'desc' },
			{ title: 'Accounts', href: '/app/accounts', icon: () => null, description: 'desc' },
		],
		bottomNavItems: [],
	}),
}))

vi.mock('@/contexts/GlobalActionContext', () => ({
	useGlobalAction: () => ({ openModal: vi.fn() }),
}))

// Mock child components
vi.mock('@/components/auth/user-nav', () => ({
	UserNav: () => <div data-testid='user-nav'>User</div>,
}))

vi.mock('@/components/common/search', () => ({
	Search: () => <div data-testid='search'>Search</div>,
}))

vi.mock('@/components/common/sidebar-controller', () => ({
	SidebarController: ({ children }: { children: (props: Record<string, unknown>) => unknown }) =>
		children({
			isMobileOpen: false,
			isExpanded: true,
			sidebarHoverEnabled: false,
			toggleCollapsed: vi.fn(),
			toggleMobile: vi.fn(),
			handleMouseEnter: vi.fn(),
			handleMouseLeave: vi.fn(),
			getSidebarClassName: () => 'sidebar-class',
		}),
}))

vi.mock('@/components/common/sidebar-nav-animated', () => ({
	AnimatedSidebarNav: ({ items }: { items: any[] }) => (
		<nav data-testid='sidebar-nav'>
			{items.map((item) => (
				<div key={item.href}>{item.title}</div>
			))}
		</nav>
	),
}))

vi.mock('@/components/common/NotificationCenter', () => ({
	NotificationCenter: () => <div data-testid='notification-center'>Notifications</div>,
}))

describe('Sidebar', () => {
	it('renders with children content', () => {
		render(
			<Sidebar>
				<div data-testid='main-content'>Content</div>
			</Sidebar>,
		)
		expect(screen.getByTestId('main-content')).toBeInTheDocument()
	})

	it('renders navigation items', () => {
		render(
			<Sidebar>
				<div>Content</div>
			</Sidebar>,
		)
		expect(screen.getByText('Dashboard')).toBeInTheDocument()
		expect(screen.getByText('Accounts')).toBeInTheDocument()
	})

	it('renders header components', () => {
		render(
			<Sidebar>
				<div>Content</div>
			</Sidebar>,
		)
		expect(screen.getByTestId('user-nav')).toBeInTheDocument()
		expect(screen.getByTestId('search')).toBeInTheDocument()
	})

	it('renders a skip link to the main landmark', () => {
		render(
			<Sidebar>
				<div>Content</div>
			</Sidebar>,
		)
		const skip = screen.getByRole('link', { name: 'skipToContent' })
		expect(skip).toHaveAttribute('href', '#main-content')
		expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content')
	})

	it('shows only the small section label in the top bar (no subtitle, no heading)', () => {
		render(
			<Sidebar>
				<div>Content</div>
			</Sidebar>,
		)
		expect(screen.queryByRole('heading')).not.toBeInTheDocument()
		expect(screen.queryByText('dashboardDesc')).not.toBeInTheDocument()
	})

	it('names the collapse toggle', () => {
		render(
			<Sidebar>
				<div>Content</div>
			</Sidebar>,
		)
		expect(screen.getByRole('button', { name: 'collapse' })).toBeInTheDocument()
	})
})
