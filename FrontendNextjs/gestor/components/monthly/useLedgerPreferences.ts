'use client'

import { type Dispatch, type SetStateAction, useEffect, useState } from 'react'
import { LEDGER_GROUP_BY, type LedgerGroupBy } from '@/lib/monthlyPlanUtils'

export interface LedgerPreferences {
	groupBy: LedgerGroupBy
	/** Group key → collapsed. Groups not listed are expanded. */
	collapsed: Record<string, boolean>
}

export const DEFAULT_LEDGER_PREFERENCES: LedgerPreferences = { groupBy: 'category', collapsed: {} }

const STORAGE_PREFIX = 'sbf:monthly-plan:ledger:'

/** localStorage key of a user's ledger preferences (null without a user: nothing is stored). */
export function ledgerStorageKey(userId: string | undefined): string | null {
	return userId ? `${STORAGE_PREFIX}${userId}` : null
}

/** Reads and validates stored preferences; anything unreadable falls back to the defaults. */
export function readLedgerPreferences(storageKey: string | null): LedgerPreferences {
	if (!storageKey || typeof window === 'undefined') return DEFAULT_LEDGER_PREFERENCES
	try {
		const raw = window.localStorage.getItem(storageKey)
		if (!raw) return DEFAULT_LEDGER_PREFERENCES
		const parsed = JSON.parse(raw) as Partial<LedgerPreferences>
		const groupBy = LEDGER_GROUP_BY.includes(parsed.groupBy as LedgerGroupBy)
			? (parsed.groupBy as LedgerGroupBy)
			: DEFAULT_LEDGER_PREFERENCES.groupBy
		const collapsed: Record<string, boolean> = {}
		if (parsed.collapsed && typeof parsed.collapsed === 'object') {
			for (const [key, value] of Object.entries(parsed.collapsed)) if (value === true) collapsed[key] = true
		}
		return { groupBy, collapsed }
	} catch {
		// Private mode, blocked storage or a corrupt value: start from the defaults.
		return DEFAULT_LEDGER_PREFERENCES
	}
}

function writeLedgerPreferences(storageKey: string | null, preferences: LedgerPreferences) {
	if (!storageKey) return
	try {
		window.localStorage.setItem(storageKey, JSON.stringify(preferences))
	} catch {
		// Storage full or blocked: the preference just isn't remembered.
	}
}

/**
 * Group-by choice and collapsed groups of the plan ledger, remembered per user
 * in localStorage (a per-viewer convenience: it never has to reach the server).
 */
export function useLedgerPreferences(
	userId: string | undefined,
): [LedgerPreferences, Dispatch<SetStateAction<LedgerPreferences>>] {
	const storageKey = ledgerStorageKey(userId)
	const [state, setState] = useState(() => ({ storageKey, preferences: readLedgerPreferences(storageKey) }))

	// Another user (or the user id arriving late): load that user's preferences.
	let preferences = state.preferences
	if (state.storageKey !== storageKey) {
		preferences = readLedgerPreferences(storageKey)
		setState({ storageKey, preferences })
	}

	useEffect(() => {
		if (state.storageKey === storageKey) writeLedgerPreferences(storageKey, state.preferences)
	}, [storageKey, state])

	const setPreferences: Dispatch<SetStateAction<LedgerPreferences>> = (next) =>
		setState((current) => ({
			storageKey: current.storageKey,
			preferences: typeof next === 'function' ? next(current.preferences) : next,
		}))

	return [preferences, setPreferences]
}
