import '@testing-library/jest-dom'
import { vi } from 'vitest'

// `server-only` throws outside the react-server condition; tests import server modules directly.
vi.mock('server-only', () => ({}))

// jsdom has no matchMedia. Default to a desktop viewport so responsive
// components (FormDialog) render their Dialog, not the mobile vaul Drawer.
// Tests that need another viewport can still override window.matchMedia.
if (typeof window !== 'undefined' && !window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: (query: string) => ({
            matches: /min-width/.test(query),
            media: query,
            onchange: null,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            addListener: vi.fn(),
            removeListener: vi.fn(),
            dispatchEvent: vi.fn(),
        }),
    })
}

// Mock next-auth globally to avoid issues with next/server imports in JSDOM
vi.mock('next-auth', () => ({
    default: vi.fn(),
    getServerSession: vi.fn(),
}))

vi.mock('next-auth/react', () => ({
    useSession: vi.fn(() => ({ data: null, status: 'unauthenticated' })),
    getSession: vi.fn(() => Promise.resolve(null)),
    signIn: vi.fn(),
    signOut: vi.fn(),
    Provider: ({ children }: any) => children,
    SessionProvider: ({ children }: any) => children,
}))

// Mock our auth configuration
vi.mock('@/auth', () => ({
    auth: vi.fn(() => Promise.resolve(null)),
    handlers: { GET: vi.fn(), POST: vi.fn() },
    signIn: vi.fn(),
    signOut: vi.fn(),
}))

// Mock next/navigation
vi.mock('next/navigation', () => ({
    useRouter: () => ({
        push: vi.fn(),
        replace: vi.fn(),
        prefetch: vi.fn(),
        back: vi.fn(),
    }),
    usePathname: () => '',
    useSearchParams: () => new URLSearchParams(),
}))
