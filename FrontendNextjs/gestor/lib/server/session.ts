import 'server-only'
import { cache } from 'react'
import { auth } from '@/auth'

/**
 * The next-auth session for the current server render, computed once per
 * request: the root layout, the /app layout and pages share one cookie decode
 * and one `jwt` callback instead of one each.
 */
export const getServerSession = cache(() => auth())
