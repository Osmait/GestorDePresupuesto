'use client'

import { useSession } from 'next-auth/react'
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { BackendNotification } from '@/app/repository/notificationRepository'
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
	markAsRead: (id: string) => void
	markAllAsRead: () => void
	clearNotifications: () => void
}

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

export function NotificationProvider({ children }: { children: React.ReactNode }) {
	const { status } = useSession()
	const { lastMessage, isConnected } = useNotification()
	const [notifications, setNotifications] = useState<NotificationItem[]>([])

	// Aborted when the provider unmounts, so in-flight history requests are
	// cancelled (e.g. during the post-login navigation) instead of resolving
	// into an unmounted provider.
	const lifecycleRef = useRef<AbortController | null>(null)
	// Set while the document is being unloaded: the browser then cancels pending
	// fetches with a generic network TypeError that is not a real failure.
	const pageHiddenRef = useRef(false)

	useEffect(() => {
		const controller = new AbortController()
		lifecycleRef.current = controller
		const onPageHide = () => {
			pageHiddenRef.current = true
		}
		const onPageShow = () => {
			pageHiddenRef.current = false
		}
		window.addEventListener('pagehide', onPageHide)
		window.addEventListener('pageshow', onPageShow)
		return () => {
			controller.abort()
			window.removeEventListener('pagehide', onPageHide)
			window.removeEventListener('pageshow', onPageShow)
		}
	}, [])

	const fetchHistory = useCallback(async () => {
		const signal = lifecycleRef.current?.signal
		try {
			const history = await getNotificationRepository().getHistory(signal)
			if (signal?.aborted) return
			setNotifications(history.map(toNotificationItem))
		} catch (error) {
			// Cancelled requests (unmount, navigation, page unload) are expected.
			if (signal?.aborted || isAbortError(error) || pageHiddenRef.current) return
			console.error('Failed to fetch notification history', error)
		}
	}, [])

	useEffect(() => {
		if (status === 'authenticated') {
			void fetchHistory()
		}
	}, [status, fetchHistory])

	// Real-time notifications: use the database id from the SSE payload when the
	// backend sends it; otherwise re-sync from history (the backend persists the
	// notification before publishing it) so markAsRead always targets a real id.
	useEffect(() => {
		if (!lastMessage) return
		const id = lastMessage.id
		if (!id) {
			void fetchHistory()
			return
		}
		setNotifications((prev) => {
			if (prev.some((n) => n.id === id)) return prev
			return [
				{
					id,
					type: lastMessage.type,
					message: lastMessage.message,
					amount: lastMessage.amount,
					timestamp: Date.now(),
					read: false,
				},
				...prev,
			]
		})
	}, [lastMessage, fetchHistory])

	const unreadCount = notifications.filter((n) => !n.read).length

	const markAsRead = useCallback(async (id: string) => {
		setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
		try {
			await getNotificationRepository().markAsRead(id)
		} catch (error) {
			console.error('Failed to mark notification as read', error)
		}
	}, [])

	const markAllAsRead = useCallback(async () => {
		setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
		try {
			await getNotificationRepository().markAllAsRead()
		} catch (error) {
			console.error('Failed to mark all as read', error)
		}
	}, [])

	const clearNotifications = useCallback(async () => {
		setNotifications([])
		try {
			await getNotificationRepository().deleteAll()
		} catch (error) {
			console.error('Failed to delete all notifications', error)
		}
	}, [])

	return (
		<NotificationContext.Provider
			value={{ notifications, unreadCount, isConnected, markAsRead, markAllAsRead, clearNotifications }}
		>
			{children}
		</NotificationContext.Provider>
	)
}

export function useNotificationContext() {
	const context = useContext(NotificationContext)
	if (context === undefined) {
		throw new Error('useNotificationContext must be used within a NotificationProvider')
	}
	return context
}
