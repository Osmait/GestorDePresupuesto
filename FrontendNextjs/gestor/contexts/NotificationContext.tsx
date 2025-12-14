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

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const { lastMessage, isConnected } = useNotification()
    const [notifications, setNotifications] = useState<NotificationItem[]>([])

    // Load from local storage on mount
    useEffect(() => {
        const saved = localStorage.getItem('notifications')
        if (saved) {
            try {
                setNotifications(JSON.parse(saved))
            } catch (e) {
                console.error("Failed to load notifications", e)
            }
        }
    }, [])

    // Save to local storage on change
    useEffect(() => {
        localStorage.setItem('notifications', JSON.stringify(notifications))
    }, [notifications])

    // Add new notification when lastMessage changes
    useEffect(() => {
        if (lastMessage) {
            const newItem: NotificationItem = {
                id: Date.now().toString(), // Simple ID
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

    const markAsRead = useCallback((id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    }, [])

    const markAllAsRead = useCallback(() => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    }, [])

    const clearNotifications = useCallback(() => {
        setNotifications([])
    }, [])

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
