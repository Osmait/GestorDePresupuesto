import { useEffect, useState } from 'react'
import { fetchEventSource } from '@microsoft/fetch-event-source'
import { toast } from 'sonner'
import { useSession } from "next-auth/react"

interface NotificationEvent {
    type: string
    message: string
    amount?: number
}

export function useNotification() {
    const { data: session } = useSession()
    const [lastMessage, setLastMessage] = useState<NotificationEvent | null>(null)
    const [isConnected, setIsConnected] = useState(false)

    useEffect(() => {
        // @ts-ignore
        const token = session?.accessToken || (session?.user as any)?.accessToken

        if (!token) {
            console.log("SSE: Waiting for session token...")
            return
        }

        const controller = new AbortController()

        const connect = async () => {
            await fetchEventSource('http://localhost:8080/notifications', {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                signal: controller.signal,
                onopen(response) {
                    if (response.ok) {
                        console.log("SSE Connected successfully!")
                        setIsConnected(true)
                        return Promise.resolve()
                    } else {
                        console.error("SSE Connection failed", response.statusText)
                        setIsConnected(false)
                        return Promise.reject()
                    }
                },
                onmessage(ev) {
                    console.log("SSE Message Received:", ev.data)
                    console.log("SSE Event Type:", ev.event)
                    try {
                        const data = JSON.parse(ev.data) as NotificationEvent
                        setLastMessage(data)

                        // Show toast immediately
                        toast(data.message, {
                            description: data.type === 'recurring_executed' ? `Amount: $${data.amount}` : undefined,
                            action: {
                                label: 'Dismiss',
                                onClick: () => console.log('Dismissed'),
                            },
                        })
                    } catch (error) {
                        console.error('Failed to parse notification:', error)
                    }
                },
                onerror(err) {
                    console.error('SSE Error:', err)
                    setIsConnected(false)
                    // Rethrow to allow auto-retry
                    // Or return nothing to stop retrying
                },
            })
        }

        connect()

        return () => {
            setIsConnected(false)
            controller.abort()
        }
    }, [session])

    return { lastMessage, isConnected }
}
