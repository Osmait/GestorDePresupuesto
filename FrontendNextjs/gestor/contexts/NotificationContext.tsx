'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useNotification } from '@/hooks/useNotification'

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

import { useSession } from "next-auth/react"

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const { data: session } = useSession()
    const { lastMessage, isConnected } = useNotification()
    const [notifications, setNotifications] = useState<NotificationItem[]>([])

    // Fetch history on mount
    useEffect(() => {
        // @ts-ignore
        const token = session?.accessToken || (session?.user as any)?.accessToken
        if (!token) return

        const fetchHistory = async () => {
            try {
                const res = await fetch(`${BASE_URL}/notifications/history`, {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                })
                if (res.ok) {
                    const data = await res.json()
                    // Map backend data to frontend model
                    const mapped = (Array.isArray(data) ? data : []).map((n: any) => ({
                        id: n.id,
                        type: n.type,
                        message: n.message,
                        amount: n.amount,
                        timestamp: new Date(n.created_at).getTime(),
                        read: n.is_read
                    }))
                    setNotifications(mapped)
                }
            } catch (error) {
                console.error("Failed to fetch notification history", error)
            }
        }

        fetchHistory()
    }, [session])

    // Add new notification when lastMessage changes (Real-time)
    useEffect(() => {
        if (lastMessage) {
            const newItem: NotificationItem = {
                id: Date.now().toString(), // Helper ID until we sync back with DB IDs for real-time
                type: lastMessage.type,
                message: lastMessage.message,
                amount: lastMessage.amount,
                timestamp: Date.now(),
                read: false
            }
            setNotifications(prev => [newItem, ...prev])
        }
    }, [lastMessage])

    const unreadCount = notifications.filter(n => !n.read).length

    const markAsRead = useCallback(async (id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))

        // @ts-ignore
        const token = session?.accessToken || (session?.user as any)?.accessToken
        if (!token) return

        try {
            await fetch(`${BASE_URL}/notifications/${id}/read`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${token}`
                }
            })
        } catch (error) {
            console.error("Failed to mark notification as read", error)
        }
    }, [session])

    const markAllAsRead = useCallback(async () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })))

        // @ts-ignore
        const token = session?.accessToken || (session?.user as any)?.accessToken
        if (!token) return

        try {
            await fetch(`${BASE_URL}/notifications/read-all`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${token}`
                }
            })
        } catch (error) {
            console.error("Failed to mark all as read", error)
        }
    }, [session])

    const clearNotifications = useCallback(async () => {
        setNotifications([])

        // @ts-ignore
        const token = session?.accessToken || (session?.user as any)?.accessToken
        if (!token) return

        try {
            await fetch(`${BASE_URL}/notifications`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${token}`
                }
            })
        } catch (error) {
            console.error("Failed to delete all notifications", error)
        }
    }, [session])

    return (
        <NotificationContext.Provider value={{ notifications, unreadCount, isConnected, markAsRead, markAllAsRead, clearNotifications }}>
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
