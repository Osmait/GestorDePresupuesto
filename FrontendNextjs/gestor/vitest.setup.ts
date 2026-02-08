import '@testing-library/jest-dom'
import { vi } from 'vitest'

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
