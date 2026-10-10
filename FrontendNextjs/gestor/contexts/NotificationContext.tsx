'use client'

import { type InfiniteData, useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react'
import type { BackendNotification, NotificationHistoryPage } from '@/app/repository/notificationRepository'
import { useNotification } from '@/hooks/useNotification'
import { isAbortError } from '@/lib/abort'
import { getNotificationRepository } from '@/lib/repositoryConfig'

export interface NotificationItem {
	id: string
	type: string
	message: string
	amount?: number
	timestamp: number
	read: boolean
}

interface NotificationContexttype {
	notifications: NotificationItem[]
	unreadCount: number
	isConnected: boolean
	/** True when older notifications can be loaded with `loadMore`. */
	hasMore: boolean
	isLoadingMore: boolean
	loadMore: () => void
	markAsRead: (id: string) => void
	markAllAsRead: () => void
	clearNotifications: () => void
}

export const NOTIFICATION_KEYS = {
	all: ['notifications'] as const,
	history: (userId: string) => [...NOTIFICATION_KEYS.all, 'history', userId] as const,
}

/** The SSE stream keeps the list current; the history itself only needs an occasional re-sync. */
const HISTORY_STALE_TIME_MS = 5 * 60 * 1000

type HistoryData = InfiniteData<NotificationHistoryPage, string | null>

const NotificationContext = createContext<NotificationContexttype | undefined>(undefined)

function toNotificationItem(n: BackendNotification): NotificationItem {
	return {
		id: n.id,
		type: n.type,
		message: n.message,
		amount: n.amount,
		timestamp: new Date(n.created_at).getTime(),
		read: n.is_read,
	}
}

function mapHistory(data: HistoryData, update: (n: BackendNotification) => BackendNotification): HistoryData {
	return { ...data, pages: data.pages.map((page) => ({ ...page, items: page.items.map(update) })) }
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
	const { data: session, status } = useSession()
	const { lastMessage, isConnected } = useNotification()
	const queryClient = useQueryClient()
	const historyKey = useMemo(() => NOTIFICATION_KEYS.history(session?.user?.id ?? ''), [session?.user?.id])

	// Set while the document is being unloaded: the browser then cancels pending
	// fetches with a generic network TypeError that is not a real failure.
	const pageHiddenRef = useRef(false)

	useEffect(() => {
		const onPageHide = () => {
			pageHiddenRef.current = true
		}
		const onPageShow = () => {
			pageHiddenRef.current = false
		}
		window.addEventListener('pagehide', onPageHide)
		window.addEventListener('pageshow', onPageShow)
		return () => {
			window.removeEventListener('pagehide', onPageHide)
			window.removeEventListener('pageshow', onPageShow)
		}
	}, [])

	// Bounded pages (50) instead of the whole history. The query's signal is
	// aborted when the provider unmounts mid-request (e.g. during the post-login
	// navigation), so the request is cancelled instead of resolving into nothing.
	const history = useInfiniteQuery({
		queryKey: historyKey,
		queryFn: async ({ pageParam, signal }) => {
			try {
				return await getNotificationRepository().getHistory(signal, { cursor: pageParam })
			} catch (error) {
				// Cancelled requests (unmount, navigation, page unload) are expected.
				if (!signal.aborted && !isAbortError(error) && !pageHiddenRef.current) {
					console.error('Failed to fetch notification history', error)
				}
				throw error
			}
		},
		initialPageParam: null as string | null,
		getNextPageParam: (lastPage) => lastPage.nextCursor,
		enabled: status === 'authenticated',
		staleTime: HISTORY_STALE_TIME_MS,
		retry: false,
	})

	const historyData = history.data
	const notifications = useMemo(() => {
		const seen = new Set<string>()
		const items: NotificationItem[] = []
		for (const page of historyData?.pages ?? []) {
			for (const n of page.items) {
				if (seen.has(n.id)) continue
				seen.add(n.id)
				items.push(toNotificationItem(n))
			}
		}
		return items
	}, [historyData])

	const updateHistory = useCallback(
		(update: (data: HistoryData) => HistoryData) => {
			queryClient.setQueryData<HistoryData>(historyKey, (data) => (data ? update(data) : data))
		},
		[queryClient, historyKey],
	)

	// Real-time notifications: use the database id from the SSE payload when the
	// backend sends it; otherwise re-sync from history (the backend persists the
	// notification before publishing it) so markAsRead always targets a real id.
	useEffect(() => {
		if (!lastMessage) return
		const id = lastMessage.id
		if (!id) {
			void queryClient.invalidateQueries({ queryKey: historyKey })
			return
		}
		const incoming: BackendNotification = {
			id,
			type: lastMessage.type,
			message: lastMessage.message,
			amount: lastMessage.amount,
			is_read: false,
			created_at: new Date().toISOString(),
		}
		updateHistory((data) => {
			if (data.pages.some((page) => page.items.some((n) => n.id === id))) return data
			const [first, ...rest] = data.pages
			return { ...data, pages: [{ ...first, items: [incoming, ...first.items] }, ...rest] }
		})
	}, [lastMessage, queryClient, historyKey, updateHistory])

	const unreadCount = notifications.filter((n) => !n.read).length

	const { hasNextPage, isFetchingNextPage, fetchNextPage } = history
	const loadMore = useCallback(() => {
		if (hasNextPage && !isFetchingNextPage) void fetchNextPage()
	}, [hasNextPage, isFetchingNextPage, fetchNextPage])

	const markAsRead = useCallback(
		async (id: string) => {
			updateHistory((data) => mapHistory(data, (n) => (n.id === id ? { ...n, is_read: true } : n)))
			try {
				await getNotificationRepository().markAsRead(id)
			} catch (error) {
				console.error('Failed to mark notification as read', error)
			}
		},
		[updateHistory],
	)

	const markAllAsRead = useCallback(async () => {
		updateHistory((data) => mapHistory(data, (n) => ({ ...n, is_read: true })))
		try {
			await getNotificationRepository().markAllAsRead()
		} catch (error) {
			console.error('Failed to mark all as read', error)
		}
	}, [updateHistory])

	const clearNotifications = useCallback(async () => {
		updateHistory((data) => ({ pages: [{ items: [], nextCursor: null }], pageParams: [data.pageParams[0] ?? null] }))
		try {
			await getNotificationRepository().deleteAll()
		} catch (error) {
			console.error('Failed to delete all notifications', error)
		}
	}, [updateHistory])

	const value = useMemo(
		() => ({
			notifications,
			unreadCount,
			isConnected,
			hasMore: !!hasNextPage,
			isLoadingMore: isFetchingNextPage,
			loadMore,
			markAsRead,
			markAllAsRead,
			clearNotifications,
		}),
		[
			notifications,
			unreadCount,
			isConnected,
			hasNextPage,
			isFetchingNextPage,
			loadMore,
			markAsRead,
			markAllAsRead,
			clearNotifications,
		],
	)

	return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}

export function useNotificationContext() {
	const context = useContext(NotificationContext)
	if (context === undefined) {
		throw new Error('useNotificationContext must be used within a NotificationProvider')
	}
	return context
}
