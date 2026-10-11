'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useMemo } from 'react'
import { type AnalysisPeriod, parsePeriodParam, serializePeriod, startOfDay } from '@/lib/analysisReport'

export interface AnalysisUrlState {
	/** Local midnight of today: the report never looks past it. */
	today: Date
	period: AnalysisPeriod
	/** Account filter (`?account=`), undefined for all accounts. */
	accountId?: string
	setPeriod: (period: AnalysisPeriod) => void
	setAccount: (accountId: string | null) => void
}

/**
 * Period and account of the report, mirrored in the URL (`?period=2026-10&account=…`)
 * so a report can be linked and survives a reload. Writes go through
 * `history.replaceState` (Next keeps `useSearchParams` in sync), like PageTabs.
 */
export function useAnalysisUrlState(): AnalysisUrlState {
	const searchParams = useSearchParams()
	const pathname = usePathname()
	// Recomputed per render on purpose: cheap, and a tab left open past midnight moves on.
	const today = startOfDay(new Date())
	const todayKey = today.getTime()
	const periodParam = searchParams.get('period')
	const period = useMemo(() => parsePeriodParam(periodParam, new Date(todayKey)), [periodParam, todayKey])
	const accountId = searchParams.get('account') || undefined

	const write = useCallback(
		(patch: Record<string, string | null>) => {
			const params = new URLSearchParams(searchParams.toString())
			for (const [key, value] of Object.entries(patch)) {
				if (value) params.set(key, value)
				else params.delete(key)
			}
			const query = params.toString()
			window.history.replaceState(null, '', query ? `${pathname}?${query}` : pathname)
		},
		[pathname, searchParams],
	)

	const setPeriod = useCallback((next: AnalysisPeriod) => write({ period: serializePeriod(next) }), [write])
	const setAccount = useCallback(
		(next: string | null) => write({ account: next && next !== 'all' ? next : null }),
		[write],
	)

	return { today, period, accountId, setPeriod, setAccount }
}
