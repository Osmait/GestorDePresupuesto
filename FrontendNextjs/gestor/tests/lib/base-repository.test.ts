import { getSession, signOut } from 'next-auth/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BaseRepository } from '@/lib/base-repository'

class TestRepository extends BaseRepository {
	load(path: string) {
		return this.get<unknown>(path)
	}
}

function response(status: number, body: unknown = {}) {
	return {
		ok: status >= 200 && status < 300,
		status,
		statusText: '',
		headers: new Headers({ 'content-type': 'application/json' }),
		json: () => Promise.resolve(body),
	}
}

describe('BaseRepository (browser)', () => {
	const fetchMock = vi.fn()

	beforeEach(() => {
		fetchMock.mockReset()
		vi.mocked(getSession).mockReset()
		vi.mocked(signOut).mockReset()
		global.fetch = fetchMock as unknown as typeof fetch
	})

	it('calls the same-origin proxy without any Authorization header', async () => {
		fetchMock.mockResolvedValue(response(200, { ok: true }))

		await new TestRepository().load('/account')

		const [url, init] = fetchMock.mock.calls[0]
		expect(url).toBe('/api/backend/account')
		expect(init.headers).not.toHaveProperty('Authorization')
		expect(getSession).not.toHaveBeenCalled()
	})

	it('concurrent 401s share one session re-fetch and retry once each', async () => {
		let calls = 0
		fetchMock.mockImplementation(() => Promise.resolve(++calls <= 3 ? response(401) : response(200, { ok: true })))
		vi.mocked(getSession).mockResolvedValue({ user: { id: 'u1' }, expires: '2099-01-01' } as any)

		const repo = new TestRepository()
		const results = await Promise.all([repo.load('/a'), repo.load('/b'), repo.load('/c')])

		expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }])
		expect(getSession).toHaveBeenCalledTimes(1)
		expect(fetchMock).toHaveBeenCalledTimes(6)
	})

	it('does not loop when the retry is still unauthorized', async () => {
		fetchMock.mockResolvedValue(response(401))
		vi.mocked(getSession).mockResolvedValue({ user: { id: 'u1' }, expires: '2099-01-01' } as any)

		await expect(new TestRepository().load('/a')).rejects.toMatchObject({ status: 401 })
		expect(fetchMock).toHaveBeenCalledTimes(2)
		expect(getSession).toHaveBeenCalledTimes(1)
	})

	it('signs out when the session refresh failed', async () => {
		fetchMock.mockResolvedValue(response(401))
		vi.mocked(getSession).mockResolvedValue({ user: { id: 'u1' }, expires: '', error: 'RefreshTokenError' } as any)

		await expect(new TestRepository().load('/a')).rejects.toMatchObject({ status: 401 })
		expect(signOut).toHaveBeenCalledWith({ callbackUrl: '/login?callbackUrl=%2F&reason=session_expired' })
		expect(fetchMock).toHaveBeenCalledTimes(1)
	})
})
