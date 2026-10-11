'use client'

import { formatDistanceToNow } from 'date-fns'
import { Bell, Check, Loader2, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Amount } from '@/components/shared/Amount'
import { EmptyState } from '@/components/shared/EmptyState'
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
import { NotificationItem, useNotificationContext } from '@/contexts/NotificationContext'
import { useDateFnsLocale } from '@/lib/i18n/date-locale'
import { cn } from '@/lib/utils'

export function NotificationCenter() {
	const {
		notifications,
		unreadCount,
		isConnected,
		hasMore,
		isLoadingMore,
		loadMore,
		markAsRead,
		markAllAsRead,
		clearNotifications,
	} = useNotificationContext()
	const t = useTranslations('nav.notificationCenter')
	const tActions = useTranslations('common.actions')

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant='ghost'
					size='icon'
					className='relative'
					aria-label={unreadCount > 0 ? t('openUnread', { count: unreadCount }) : t('open')}
				>
					<Bell className='h-4 w-4' aria-hidden='true' />
					{unreadCount > 0 && (
						<span
							aria-hidden='true'
							className='absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-xs leading-none font-medium text-destructive-foreground tabular-nums'
						>
							{unreadCount > 9 ? '9+' : unreadCount}
						</span>
					)}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align='end' className='w-80 max-w-[calc(100vw-1rem)]'>
				<div className='flex items-center justify-between gap-2 p-2'>
					<div className='flex min-w-0 flex-col gap-0.5'>
						<DropdownMenuLabel className='p-0'>{t('title', { count: notifications.length })}</DropdownMenuLabel>
						<span className='flex items-center gap-1.5 text-xs text-muted-foreground'>
							<span
								aria-hidden='true'
								className={cn('h-2 w-2 rounded-full', isConnected ? 'bg-success' : 'bg-muted-foreground')}
							/>
							{isConnected ? t('connected') : t('disconnected')}
						</span>
					</div>
					<div className='flex shrink-0 gap-1'>
						{unreadCount > 0 && (
							<Button
								variant='ghost'
								size='icon'
								aria-label={t('markAllRead')}
								title={t('markAllRead')}
								onClick={(e) => {
									e.preventDefault()
									markAllAsRead()
								}}
							>
								<Check className='h-4 w-4' aria-hidden='true' />
							</Button>
						)}
						{notifications.length > 0 && (
							<Button
								variant='ghost'
								size='icon'
								className='hover:text-destructive'
								aria-label={t('clearAll')}
								title={t('clearAll')}
								onClick={(e) => {
									e.preventDefault()
									clearNotifications()
								}}
							>
								<Trash2 className='h-4 w-4' aria-hidden='true' />
							</Button>
						)}
					</div>
				</div>
				<DropdownMenuSeparator />
				<ScrollArea className='h-[300px] max-h-[60dvh]'>
					{notifications.length === 0 ? (
						<EmptyState compact icon={Bell} title={t('empty')} />
					) : (
						<div className='flex flex-col'>
							{notifications.map((notification) => (
								<NotificationItemRow key={notification.id} item={notification} onRead={markAsRead} />
							))}
							{hasMore && (
								<Button
									variant='ghost'
									size='sm'
									className='m-2 text-xs'
									disabled={isLoadingMore}
									aria-busy={isLoadingMore || undefined}
									onClick={(e) => {
										e.preventDefault()
										loadMore()
									}}
								>
									{isLoadingMore ? <Loader2 className='mr-2 h-3.5 w-3.5 animate-spin' aria-hidden='true' /> : null}
									{tActions('loadMore')}
								</Button>
							)}
						</div>
					)}
				</ScrollArea>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

function NotificationItemRow({ item, onRead }: { item: NotificationItem; onRead: (_id: string) => void }) {
	const t = useTranslations('nav.notificationCenter')
	const dateLocale = useDateFnsLocale()

	return (
		<DropdownMenuItem
			className={cn('flex cursor-pointer flex-col items-start gap-1 p-3', !item.read && 'bg-accent/40')}
			onClick={() => onRead(item.id)}
		>
			<div className='flex w-full items-start justify-between gap-2'>
				<div className='text-sm font-medium leading-none'>
					{item.type === 'recurring_executed' ? t('recurringExecuted') : t('generic')}
				</div>
				{!item.read && (
					<span className='flex items-center'>
						<span className='h-2 w-2 rounded-full bg-info' aria-hidden='true' />
						<span className='sr-only'>{t('unread')}</span>
					</span>
				)}
			</div>
			<p className='line-clamp-2 text-xs text-muted-foreground'>{item.message}</p>
			<div className='mt-1 flex w-full items-center justify-between text-xs text-muted-foreground'>
				<span>{formatDistanceToNow(item.timestamp, { addSuffix: true, locale: dateLocale })}</span>
				{item.amount ? <Amount className='font-medium text-foreground' value={item.amount} /> : null}
			</div>
		</DropdownMenuItem>
	)
}
