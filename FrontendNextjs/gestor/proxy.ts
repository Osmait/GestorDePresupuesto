import { type NextRequest, NextResponse } from 'next/server'
import { isUsableSession, readSessionJwt } from '@/lib/auth/session-cookie'

const LOGIN_PATH = '/login'
const ADMIN_PREFIX = '/admin'
const NON_ADMIN_FALLBACK = '/app'

function redirectToLogin(req: NextRequest) {
	const loginUrl = new URL(LOGIN_PATH, req.nextUrl.origin)
	loginUrl.searchParams.set('callbackUrl', `${req.nextUrl.pathname}${req.nextUrl.search}`)
	return NextResponse.redirect(loginUrl)
}

/**
 * Route protection only (Next.js proxy, Node.js runtime): decodes the session
 * cookie and never refreshes backend tokens (that happens exclusively in the
 * next-auth `jwt` callback).
 */
export async function proxy(req: NextRequest) {
	const token = await readSessionJwt(req.headers)
	if (!isUsableSession(token)) {
		return redirectToLogin(req)
	}

	const { pathname } = req.nextUrl
	const isAdminRoute = pathname === ADMIN_PREFIX || pathname.startsWith(`${ADMIN_PREFIX}/`)
	if (isAdminRoute && token.role !== 'ADMIN') {
		return NextResponse.redirect(new URL(NON_ADMIN_FALLBACK, req.nextUrl.origin))
	}

	return NextResponse.next()
}

export const config = {
	matcher: ['/app', '/app/:path*', '/admin', '/admin/:path*'],
}
