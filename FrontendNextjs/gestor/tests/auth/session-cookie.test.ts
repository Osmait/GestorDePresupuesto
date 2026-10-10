// @vitest-environment node
import { encode } from 'next-auth/jwt'
import { beforeEach, describe, expect, it } from 'vitest'
import { readSessionJwt } from '@/lib/auth/session-cookie'

const SECRET = 'test-secret-with-enough-entropy-123456'

async function cookieFor(name: string, payload: Record<string, unknown>) {
	const value = await encode({ token: payload, secret: SECRET, salt: name })
	return `${name}=${value}`
}

describe('readSessionJwt', () => {
	beforeEach(() => {
		process.env.AUTH_SECRET = SECRET
	})

	it('decodes the http session cookie', async () => {
		const cookie = await cookieFor('authjs.session-token', { id: 'u1', role: 'ADMIN' })
		const token = await readSessionJwt(new Headers({ cookie }))
		expect(token).toMatchObject({ id: 'u1', role: 'ADMIN' })
	})

	it('decodes the __Secure- cookie used on https', async () => {
		const cookie = await cookieFor('__Secure-authjs.session-token', { id: 'u2' })
		const token = await readSessionJwt(new Headers({ cookie }))
		expect(token).toMatchObject({ id: 'u2' })
	})

	it('ignores bearer tokens and tampered cookies', async () => {
		const forged = await encode({ token: { id: 'x' }, secret: 'other-secret', salt: 'authjs.session-token' })
		await expect(readSessionJwt(new Headers({ authorization: `Bearer ${forged}` }))).resolves.toBeNull()
		await expect(readSessionJwt(new Headers({ cookie: `authjs.session-token=${forged}` }))).resolves.toBeNull()
	})
})
