import 'server-only'
import { cookies, headers } from 'next/headers'
import { cache } from 'react'
import { AccountRepository } from '@/app/repository/accountRepository'
import { AnalyticsRepository } from '@/app/repository/analyticsRepository'
import { BudgetRepository } from '@/app/repository/budgetRepository'
import { CategoryRepository } from '@/app/repository/categoryRepository'
import { ExchangeRateRepository } from '@/app/repository/exchangeRateRepository'
import { TransactionRepository } from '@/app/repository/transactionRepository'
import { getBackendAccessToken } from '@/lib/auth/backend-token'
import { getBackendUrl } from '@/lib/backend-url'
import type { RepositoryOptions } from '@/lib/base-repository'
import { LOCALE_COOKIE, resolveLocale } from '@/lib/i18n/locales'
import { traceContextHeaders } from '@/lib/server/trace-context'

/** One token lookup per request, shared by every repository call in a Server Component render. */
const getServerAccessToken = cache(async () => getBackendAccessToken(await headers()))

/**
 * Per-call headers: the user's UI locale, so the backend localizes the names
 * it generates (default es), and the W3C trace context of the current render
 * so the backend's spans join the page's trace (empty when OTel is off).
 */
export async function getServerRequestHeaders(): Promise<Record<string, string>> {
	const cookieStore = await cookies()
	return {
		...traceContextHeaders(),
		'Accept-Language': resolveLocale(cookieStore.get(LOCALE_COOKIE)?.value),
	}
}

function serverOptions(): RepositoryOptions {
	return { baseUrl: getBackendUrl(), getAccessToken: getServerAccessToken, getRequestHeaders: getServerRequestHeaders }
}

/**
 * Repositories for Server Components: they call the backend directly with the
 * token from the session cookie. Browser code must use `@/lib/repositoryConfig`.
 */
export const serverAccountRepository = new AccountRepository(serverOptions())
export const serverAnalyticsRepository = new AnalyticsRepository(serverOptions())
export const serverBudgetRepository = new BudgetRepository(serverOptions())
export const serverCategoryRepository = new CategoryRepository(serverOptions())
export const serverExchangeRateRepository = new ExchangeRateRepository(serverOptions())
export const serverTransactionRepository = new TransactionRepository(serverOptions())
