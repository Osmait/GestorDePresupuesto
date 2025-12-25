import { renderHook } from '@testing-library/react'
import { useNavItems } from '@/hooks/use-nav-items'
import { vi } from 'vitest'

// Mock next-intl
vi.mock('next-intl', () => ({
    useTranslations: () => (key: string) => key
}))

// Mock useAdmin
vi.mock('@/hooks/useAdmin', () => ({
    useAdmin: () => ({
        isAdmin: false,
        isLoading: false
    })
}))

describe('useNavItems', () => {
    it('returns navigation items array', () => {
        const { result } = renderHook(() => useNavItems())

        expect(result.current.navItems).toBeDefined()
        expect(Array.isArray(result.current.navItems)).toBe(true)
        expect(result.current.navItems.length).toBeGreaterThan(0)
    })

    it('includes essential nav items', () => {
        const { result } = renderHook(() => useNavItems())

        const hrefs = result.current.navItems.map(item => item.href)

        expect(hrefs).toContain('/app')
        expect(hrefs).toContain('/app/accounts')
        expect(hrefs).toContain('/app/transactions')
        expect(hrefs).toContain('/app/category')
        expect(hrefs).toContain('/app/budget')
        expect(hrefs).toContain('/app/investments')
        expect(hrefs).toContain('/app/analysis')
    })

    it('each nav item has required properties', () => {
        const { result } = renderHook(() => useNavItems())

        result.current.navItems.forEach(item => {
            expect(item.title).toBeDefined()
            expect(item.href).toBeDefined()
            expect(item.icon).toBeDefined()
            expect(item.description).toBeDefined()
        })
    })

    it('returns bottomNavItems array', () => {
        const { result } = renderHook(() => useNavItems())

        expect(result.current.bottomNavItems).toBeDefined()
        expect(Array.isArray(result.current.bottomNavItems)).toBe(true)
    })
})
