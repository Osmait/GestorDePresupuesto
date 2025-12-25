'use client'

import React from 'react'
import { Bell, Check, Trash2, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useNotificationContext, NotificationItem } from '@/contexts/NotificationContext'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

import { useSession } from "next-auth/react"

export function NotificationCenter() {
    const { data: session } = useSession()
    const { notifications, unreadCount, isConnected, markAsRead, markAllAsRead, clearNotifications } = useNotificationContext()

    const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

    const handleTestNotification = async () => {
        // @ts-ignore
        const token = session?.accessToken || (session?.user as any)?.accessToken
        if (!token) return

        try {
            await fetch(`${BASE_URL}/notifications/test`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`
                }
            })
        } catch (error) {
            console.error("Failed to trigger test notification", error)
        }
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="relative">
                    <Bell className="h-4 w-4" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
                <div className="flex items-center justify-between p-2">
                    <div className="flex items-center gap-2">
                        <DropdownMenuLabel className="p-0 font-normal">
                            Notificaciones ({notifications.length})
                        </DropdownMenuLabel>
                        <div
                            className={cn("h-2 w-2 rounded-full", isConnected ? "bg-green-500" : "bg-red-500")}
                            title={isConnected ? "Conectado" : "Desconectado"}
                        />
                    </div>
                    <div className="flex gap-1">
                        {unreadCount > 0 && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={(e) => {
                                    e.preventDefault()
                                    markAllAsRead()
                                }}
                                title="Marcar todas como leídas"
                            >
                                <Check className="h-4 w-4 text-muted-foreground hover:text-primary" />
                            </Button>
                        )}
                        {notifications.length > 0 && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={(e) => {
                                    e.preventDefault()
                                    clearNotifications()
                                }}
                                title="Borrar todas"
                            >
                                <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                            </Button>
                        )}
                    </div>
                </div>
                <DropdownMenuSeparator />
                <ScrollArea className="h-[300px]">
                    {notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                            <Bell className="mb-2 h-8 w-8 opacity-20" />
                            <p className="text-sm">No tienes notificaciones</p>
                        </div>
                    ) : (
                        <div className="flex flex-col">
                            {notifications.map((notification) => (
                                <NotificationItemRow key={notification.id} item={notification} onRead={markAsRead} />
                            ))}
                        </div>
                    )}
                </ScrollArea>
                <DropdownMenuSeparator />
                <div className="p-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-xs"
                        onClick={(e) => {
                            e.preventDefault()
                            handleTestNotification()
                        }}
                    >
                        <Zap className="mr-2 h-3 w-3" />
                        Probar Notificación
                    </Button>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

function NotificationItemRow({ item, onRead }: { item: NotificationItem; onRead: (_id: string) => void }) {
    return (
        <DropdownMenuItem
            className={cn(
                "flex flex-col items-start gap-1 p-3 cursor-pointer focus:bg-accent/50",
                !item.read && "bg-accent/20"
            )}
            onClick={() => onRead(item.id)}
        >
            <div className="flex w-full items-start justify-between gap-2">
                <div className="text-sm font-medium leading-none">
                    {item.type === 'recurring_executed' ? 'Transacción Recurrente' : 'Notificación'}
                </div>
                {!item.read && (
                    <div className="h-2 w-2 rounded-full bg-blue-500" />
                )}
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">
                {item.message}
            </p>
            <div className="mt-1 flex w-full items-center justify-between text-[10px] text-muted-foreground/60">
                <span>
                    {formatDistanceToNow(item.timestamp, { addSuffix: true, locale: es })}
                </span>
                {item.amount && (
                    <span className="font-mono font-medium text-foreground">
                        ${item.amount.toFixed(2)}
                    </span>
                )}
            </div>
        </DropdownMenuItem>
    )
}
