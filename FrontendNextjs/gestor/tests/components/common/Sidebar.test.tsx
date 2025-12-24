import { render, screen } from '@testing-library/react'
import { Sidebar } from '@/components/common/sidebar'
import { vi } from 'vitest'

// Mock hooks
vi.mock('next/navigation', () => ({
    usePathname: () => '/app'
}))

vi.mock('next-intl', () => ({
    useTranslations: () => (key: string) => key
}))

vi.mock('@/hooks/use-nav-items', () => ({
    useNavItems: () => ({
        navItems: [
            { title: 'Dashboard', href: '/app', icon: () => null, description: 'desc' },
            { title: 'Accounts', href: '/app/accounts', icon: () => null, description: 'desc' }
        ],
        bottomNavItems: []
    })
}))

vi.mock('@/contexts/GlobalActionContext', () => ({
    useGlobalAction: () => ({ openModal: vi.fn() })
}))

// Mock child components
vi.mock('@/components/auth/user-nav', () => ({
    UserNav: () => <div data-testid="user-nav">User</div>
}))

vi.mock('@/components/common/search', () => ({
    Search: () => <div data-testid="search">Search</div>
}))

vi.mock('@/components/common/sidebar-controller', () => ({
    SidebarController: ({ children }: { children: Function }) => children({
        isMobileOpen: false,
        isExpanded: true,
        sidebarHoverEnabled: false,
        toggleCollapsed: vi.fn(),
        toggleMobile: vi.fn(),
        handleMouseEnter: vi.fn(),
        handleMouseLeave: vi.fn(),
        getSidebarClassName: () => 'sidebar-class'
    })
}))

vi.mock('@/components/common/sidebar-nav-animated', () => ({
    AnimatedSidebarNav: ({ items }: { items: any[] }) => (
        <nav data-testid="sidebar-nav">
            {items.map(item => <div key={item.href}>{item.title}</div>)}
        </nav>
    )
}))

vi.mock('@/components/common/NotificationCenter', () => ({
    NotificationCenter: () => <div data-testid="notification-center">Notifications</div>
}))

describe('Sidebar', () => {
    it('renders with children content', () => {
        render(<Sidebar><div data-testid="main-content">Content</div></Sidebar>)
        expect(screen.getByTestId('main-content')).toBeInTheDocument()
    })

    it('renders navigation items', () => {
        render(<Sidebar><div>Content</div></Sidebar>)
        expect(screen.getByText('Dashboard')).toBeInTheDocument()
        expect(screen.getByText('Accounts')).toBeInTheDocument()
    })

    it('renders header components', () => {
        render(<Sidebar><div>Content</div></Sidebar>)
        expect(screen.getByTestId('user-nav')).toBeInTheDocument()
        expect(screen.getByTestId('search')).toBeInTheDocument()
    })
})
