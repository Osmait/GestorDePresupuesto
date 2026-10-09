'use client'

import {
	Bell,
	Database,
	Download,
	Globe,
	Key,
	Layout,
	Lock,
	Mail,
	Palette,
	Shield,
	Smartphone,
	User,
} from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'
import { ModeToggle } from '@/components/common/ToggleMode'
import { APIKeysSection } from '@/components/settings/APIKeysSection'
import { PasskeyManager } from '@/components/settings/PasskeyManager'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { useSettings } from '@/contexts'
import { cn } from '@/lib/utils'

/**
 * Props for the SettingsModal component.
 */
interface SettingsModalProps {
	open: boolean
	onOpenChange: (_open: boolean) => void
}

type SettingsTab = 'general' | 'security' | 'notifications' | 'data' | 'apikeys'

const sidebarNavItems: { id: SettingsTab; icon: typeof User }[] = [
	{ id: 'general', icon: User },
	{ id: 'security', icon: Shield },
	{ id: 'notifications', icon: Bell },
	{ id: 'data', icon: Database },
	{ id: 'apikeys', icon: Key },
]

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
	const [activeTab, setActiveTab] = useState<SettingsTab>('general')
	const { data: session } = useSession()
	const locale = useLocale()
	const t = useTranslations('settingsModal')
	const tCommon = useTranslations('common')
	const {
		sidebarHoverEnabled,
		setSidebarHoverEnabled,
		notifications,
		setNotifications,
		currency: _currency,
	} = useSettings()

	const getInitials = (name: string, lastName?: string) => {
		const initials = `${name?.charAt(0) || ''}${lastName?.charAt(0) || ''}`
		return initials.toUpperCase() || 'U'
	}

	const switchLocale = (newLocale: string) => {
		document.cookie = `locale=${newLocale}; path=/; max-age=31536000`
		window.location.reload()
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className='max-w-4xl h-[80vh] p-0 gap-0 overflow-hidden'>
				<div className='flex h-full'>
					{/* Sidebar */}
					<div className='w-64 border-r bg-muted/30 flex flex-col'>
						<DialogHeader className='p-6 pb-4 border-b'>
							<DialogTitle>{t('title')}</DialogTitle>
						</DialogHeader>
						<ScrollArea className='flex-1 py-4'>
							<nav className='grid gap-1 px-4'>
								{sidebarNavItems.map((item) => (
									<Button
										key={item.id}
										variant={activeTab === item.id ? 'secondary' : 'ghost'}
										className={cn('justify-start gap-3', activeTab === item.id && 'bg-muted')}
										onClick={() => setActiveTab(item.id)}
									>
										<item.icon className='h-4 w-4' />
										{t(`tabs.${item.id}`)}
									</Button>
								))}
							</nav>
						</ScrollArea>
						<div className='p-4 border-t'>
							<div className='flex items-center gap-3'>
								<Avatar className='h-9 w-9'>
									<AvatarImage src={session?.user.image || ''} />
									<AvatarFallback className='bg-primary text-primary-foreground text-xs'>
										{getInitials(session?.user.name || '', session?.user.lastName)}
									</AvatarFallback>
								</Avatar>
								<div className='grid gap-0.5 text-xs'>
									<span className='font-medium truncate max-w-[120px]'>{session?.user.name}</span>
									<span className='text-muted-foreground truncate max-w-[120px]'>{session?.user.email}</span>
								</div>
							</div>
						</div>
					</div>

					{/* Content */}
					<div className='flex-1 flex flex-col bg-background h-full overflow-hidden'>
						<ScrollArea className='flex-1'>
							<div className='p-8 max-w-2xl mx-auto space-y-8 pb-20'>
								{activeTab === 'general' && (
									<div className='space-y-8 animate-in fade-in-50 duration-300'>
										<div>
											<h3 className='text-lg font-medium'>{t('profile.title')}</h3>
											<p className='text-sm text-muted-foreground'>{t('profile.description')}</p>
											<Separator className='my-4' />
											<div className='space-y-4'>
												<div className='flex items-center justify-between p-4 border rounded-lg'>
													<div className='space-y-1'>
														<Label>{t('profile.fullName')}</Label>
														<p className='text-sm text-muted-foreground'>
															{session?.user.name} {session?.user.lastName}
														</p>
													</div>
													<Button variant='outline' size='sm'>
														{t('actions.edit')}
													</Button>
												</div>
												<div className='flex items-center justify-between p-4 border rounded-lg'>
													<div className='space-y-1'>
														<Label>{t('profile.email')}</Label>
														<p className='text-sm text-muted-foreground'>{session?.user.email}</p>
													</div>
													<Button variant='outline' size='sm'>
														{t('actions.change')}
													</Button>
												</div>
											</div>
										</div>

										<div>
											<h3 className='text-lg font-medium'>{t('appearance.title')}</h3>
											<p className='text-sm text-muted-foreground'>{t('appearance.description')}</p>
											<Separator className='my-4' />
											<div className='space-y-4'>
												<div className='flex items-center justify-between p-4 border rounded-lg'>
													<div className='space-y-1'>
														<div className='flex items-center gap-2'>
															<Palette className='h-4 w-4' />
															<Label>{t('appearance.theme')}</Label>
														</div>
														<p className='text-sm text-muted-foreground'>{t('appearance.themeDescription')}</p>
													</div>
													<ModeToggle />
												</div>
												<div className='flex items-center justify-between p-4 border rounded-lg'>
													<div className='space-y-1'>
														<div className='flex items-center gap-2'>
															<Globe className='h-4 w-4' />
															<Label>{t('appearance.language')}</Label>
														</div>
														<p className='text-sm text-muted-foreground'>{t('appearance.languageDescription')}</p>
													</div>
													<div className='flex gap-2'>
														<Button
															variant={locale === 'es' ? 'default' : 'outline'}
															size='sm'
															onClick={() => switchLocale('es')}
														>
															{tCommon('language.es')}
														</Button>
														<Button
															variant={locale === 'en' ? 'default' : 'outline'}
															size='sm'
															onClick={() => switchLocale('en')}
														>
															{tCommon('language.en')}
														</Button>
													</div>
												</div>
											</div>
										</div>

										<div>
											<h3 className='text-lg font-medium'>{t('navigation.title')}</h3>
											<p className='text-sm text-muted-foreground'>{t('navigation.description')}</p>
											<Separator className='my-4' />
											<div className='flex items-center justify-between p-4 border rounded-lg'>
												<div className='space-y-1'>
													<div className='flex items-center gap-2'>
														<Layout className='h-4 w-4' />
														<Label htmlFor='sidebar-hover'>{t('navigation.sidebarHover')}</Label>
													</div>
													<p className='text-sm text-muted-foreground max-w-[300px]'>
														{t('navigation.sidebarHoverDescription')}
													</p>
												</div>
												<Switch
													id='sidebar-hover'
													checked={sidebarHoverEnabled}
													onCheckedChange={setSidebarHoverEnabled}
												/>
											</div>
										</div>
									</div>
								)}

								{activeTab === 'security' && (
									<div className='space-y-8 animate-in fade-in-50 duration-300'>
										<div>
											<h3 className='text-lg font-medium'>{t('security.title')}</h3>
											<p className='text-sm text-muted-foreground'>{t('security.description')}</p>
											<Separator className='my-4' />
											<div className='space-y-4'>
												<div className='flex items-center justify-between p-4 border rounded-lg'>
													<div className='space-y-1'>
														<div className='flex items-center gap-2'>
															<Lock className='h-4 w-4' />
															<Label>{t('security.password')}</Label>
														</div>
														<p className='text-sm text-muted-foreground'>{t('security.passwordUpdated')}</p>
													</div>
													<Button variant='outline' size='sm'>
														{t('actions.change')}
													</Button>
												</div>
												<div className='flex items-center justify-between p-4 border rounded-lg'>
													<div className='space-y-1'>
														<div className='flex items-center gap-2'>
															<Shield className='h-4 w-4' />
															<Label>{t('security.twoFactor')}</Label>
														</div>
														<p className='text-sm text-muted-foreground'>{t('security.twoFactorDescription')}</p>
													</div>
													<Badge variant='outline' className='text-green-500 border-green-500'>
														{t('security.enabled')}
													</Badge>
												</div>
											</div>
										</div>

										<div>
											<h3 className='text-lg font-medium'>{t('devices.title')}</h3>
											<p className='text-sm text-muted-foreground'>{t('devices.description')}</p>
											<Separator className='my-4' />
											<div className='flex items-center justify-between p-4 border rounded-lg'>
												<div className='space-y-1'>
													<div className='flex items-center gap-2'>
														<Smartphone className='h-4 w-4' />
														<Label>{t('devices.activeSessions')}</Label>
													</div>
													<p className='text-sm text-muted-foreground'>{t('devices.activeSessionsDescription')}</p>
												</div>
												<Button variant='outline' size='sm'>
													{t('actions.manage')}
												</Button>
											</div>
										</div>

										<PasskeyManager />
									</div>
								)}

								{activeTab === 'notifications' && (
									<div className='space-y-8 animate-in fade-in-50 duration-300'>
										<div>
											<h3 className='text-lg font-medium'>{t('notifications.title')}</h3>
											<p className='text-sm text-muted-foreground'>{t('notifications.description')}</p>
											<Separator className='my-4' />
											<div className='grid gap-4'>
												<div className='flex items-center justify-between p-4 border rounded-lg'>
													<div className='space-y-1'>
														<div className='flex items-center gap-2'>
															<Mail className='h-4 w-4' />
															<Label htmlFor='email-notif'>{t('notifications.email')}</Label>
														</div>
														<p className='text-sm text-muted-foreground'>{t('notifications.emailDescription')}</p>
													</div>
													<Switch
														id='email-notif'
														checked={notifications.email}
														onCheckedChange={(c) => setNotifications({ ...notifications, email: c })}
													/>
												</div>
												<div className='flex items-center justify-between p-4 border rounded-lg'>
													<div className='space-y-1'>
														<div className='flex items-center gap-2'>
															<Bell className='h-4 w-4' />
															<Label htmlFor='push-notif'>{t('notifications.push')}</Label>
														</div>
														<p className='text-sm text-muted-foreground'>{t('notifications.pushDescription')}</p>
													</div>
													<Switch
														id='push-notif'
														checked={notifications.push}
														onCheckedChange={(c) => setNotifications({ ...notifications, push: c })}
													/>
												</div>
												<div className='flex items-center justify-between p-4 border rounded-lg'>
													<div className='space-y-1'>
														<div className='flex items-center gap-2'>
															<Smartphone className='h-4 w-4' />
															<Label htmlFor='sms-notif'>{t('notifications.sms')}</Label>
														</div>
														<p className='text-sm text-muted-foreground'>{t('notifications.smsDescription')}</p>
													</div>
													<Switch
														id='sms-notif'
														checked={notifications.sms}
														onCheckedChange={(c) => setNotifications({ ...notifications, sms: c })}
													/>
												</div>
											</div>
										</div>
									</div>
								)}

								{activeTab === 'data' && (
									<div className='space-y-8 animate-in fade-in-50 duration-300'>
										<div>
											<h3 className='text-lg font-medium'>{t('data.title')}</h3>
											<p className='text-sm text-muted-foreground'>{t('data.description')}</p>
											<Separator className='my-4' />
											<div className='space-y-4'>
												<div className='flex items-center justify-between p-4 border rounded-lg'>
													<div className='space-y-1'>
														<div className='flex items-center gap-2'>
															<Download className='h-4 w-4' />
															<Label>{t('data.export')}</Label>
														</div>
														<p className='text-sm text-muted-foreground'>{t('data.exportDescription')}</p>
													</div>
													<Button variant='outline' size='sm'>
														{t('actions.exportCsv')}
													</Button>
												</div>
												<div className='flex items-center justify-between p-4 border rounded-lg border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-900/50'>
													<div className='space-y-1'>
														<Label className='text-red-600 dark:text-red-400'>{t('data.dangerZone')}</Label>
														<p className='text-sm text-red-600/80 dark:text-red-400/80'>
															{t('data.dangerZoneDescription')}
														</p>
													</div>
													<Button variant='destructive' size='sm'>
														{t('actions.deleteAccount')}
													</Button>
												</div>
											</div>
										</div>
									</div>
								)}

								{activeTab === 'apikeys' && <APIKeysSection />}
							</div>
						</ScrollArea>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	)
}
