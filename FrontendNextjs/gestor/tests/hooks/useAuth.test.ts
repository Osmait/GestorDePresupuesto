import { renderHook, act } from '@testing-library/react'
import { useAuth } from '@/hooks/useRepositories'
import { vi } from 'vitest'

// Mock the repository config
const mockLogin = vi.fn()
const mockSignUp = vi.fn()
const mockGetProfile = vi.fn()

vi.mock('@/lib/repositoryConfig', () => ({
    getAuthRepository: () => Promise.resolve({
        login: mockLogin,
        signUp: mockSignUp,
        getProfile: mockGetProfile
    })
}))

describe('useAuth hook', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('initializes with null user and no loading', () => {
        const { result } = renderHook(() => useAuth())

        expect(result.current.user).toBeNull()
        expect(result.current.isLoading).toBe(false)
        expect(result.current.error).toBeNull()
    })

    it('handles successful login', async () => {
        const mockUser = { id: 'u1', name: 'John', email: 'john@test.com' }
        mockLogin.mockResolvedValue(mockUser)

        const { result } = renderHook(() => useAuth())

        await act(async () => {
            await result.current.login('john@test.com', 'password123')
        })

        expect(result.current.user).toEqual(mockUser)
        expect(result.current.isLoading).toBe(false)
        expect(result.current.error).toBeNull()
    })

    it('handles login error', async () => {
        mockLogin.mockRejectedValue(new Error('Invalid credentials'))

        const { result } = renderHook(() => useAuth())

        await act(async () => {
            try {
                await result.current.login('bad@test.com', 'wrongpass')
            } catch (e) {
                // Expected error
            }
        })

        expect(result.current.user).toBeNull()
        expect(result.current.error).toBe('Invalid credentials')
    })

    it('handles logout', async () => {
        const mockUser = { id: 'u1', name: 'John', email: 'john@test.com' }
        mockLogin.mockResolvedValue(mockUser)

        const { result } = renderHook(() => useAuth())

        await act(async () => {
            await result.current.login('john@test.com', 'password123')
        })

        expect(result.current.user).toEqual(mockUser)

        act(() => {
            result.current.logout()
        })

        expect(result.current.user).toBeNull()
        expect(result.current.error).toBeNull()
    })

    it('handles sign up', async () => {
        mockSignUp.mockResolvedValue(undefined)

        const { result } = renderHook(() => useAuth())

        await act(async () => {
            await result.current.signUp('John', 'Doe', 'john@test.com', 'password123')
        })

        expect(mockSignUp).toHaveBeenCalledWith('John', 'Doe', 'john@test.com', 'password123')
        expect(result.current.isLoading).toBe(false)
    })

    it('handles getProfile', async () => {
        const mockUser = { id: 'u1', name: 'John', email: 'john@test.com' }
        mockGetProfile.mockResolvedValue(mockUser)

        const { result } = renderHook(() => useAuth())

        await act(async () => {
            await result.current.getProfile('valid-token')
        })

        expect(result.current.user).toEqual(mockUser)
        expect(mockGetProfile).toHaveBeenCalledWith('valid-token')
    })
})
