'use client'

import {
	Bell,
	Database,
	Download,
	Globe,
	Key,
	Layout,
	Lock,
	type LucideIcon,
	Mail,
	Palette,
	Shield,
	Smartphone,
	User,
} from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useLocale, useTranslations } from 'next-intl'
import { type ReactNode, useState } from 'react'
import { ModeToggle } from '@/components/common/ToggleMode'
import { APIKeysSection } from '@/components/settings/APIKeysSection'
import { PasskeyManager } from '@/components/settings/PasskeyManager'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSettings } from '@/contexts'
import { BREAKPOINTS, useMediaQuery } from '@/hooks/useMediaQuery'
import { switchLocale } from '@/lib/i18n/switch-locale'
import { cn } from '@/lib/utils'

/**
 * Props for the SettingsModal component.
 */
interface SettingsModalProps {
	open: boolean
	onOpenChange: (_open: boolean) => void
}

type SettingsTab = 'general' | 'security' | 'notifications' | 'data' | 'apikeys'

const sidebarNavItems: { id: SettingsTab; icon: LucideIcon }[] = [
	{ id: 'general', icon: User },
	{ id: 'security', icon: Shield },
	{ id: 'notifications', icon: Bell },
	{ id: 'data', icon: Database },
	{ id: 'apikeys', icon: Key },
]

function SettingsSection({
	title,
	description,
	children,
}: {
	title: string
	description: string
	children: ReactNode
}) {
	return (
		<section>
			<h3 className='text-lg font-medium'>{title}</h3>
			<p className='text-sm text-muted-foreground'>{description}</p>
			<Separator className='my-4' />
			<div className='space-y-4'>{children}</div>
		</section>
	)
}

interface SettingRowProps {
	/** Base id: the title gets `${id}-label`, the description `${id}-desc`. */
	id: string
	icon?: LucideIcon
	title: ReactNode
	description: ReactNode
	/** id of a form control (Switch) the title labels; otherwise the title is plain text that controls reference. */
	controlId?: string
	danger?: boolean
	children: ReactNode
}

/** One setting: title + description on the left, its control on the right (under it on mobile). */
function SettingRow({ id, icon: Icon, title, description, controlId, danger = false, children }: SettingRowProps) {
	const titleClass = cn('text-sm font-medium leading-none', danger && 'text-destructive')
	return (
		<div
			className={cn(
				'flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between',
				danger && 'border-destructive/40 bg-destructive/5',
			)}
		>
			<div className='min-w-0 space-y-1'>
				<div className='flex items-center gap-2'>
					{Icon ? <Icon className='h-4 w-4 shrink-0 text-muted-foreground' aria-hidden='true' /> : null}
					{controlId ? (
						<Label id={`${id}-label`} htmlFor={controlId} className={titleClass}>
							{title}
						</Label>
					) : (
						<p id={`${id}-label`} className={titleClass}>
							{title}
						</p>
					)}
				</div>
				<p id={`${id}-desc`} className='max-w-prose text-sm text-muted-foreground'>
					{description}
				</p>
			</div>
			<div className='flex shrink-0 items-center gap-2'>{children}</div>
		</div>
	)
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
	const [activeTab, setActiveTab] = useState<SettingsTab>('general')
	const isDesktop = useMediaQuery(BREAKPOINTS.md)
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

	const notificationRows = [
		{ key: 'email', icon: Mail },
		{ key: 'push', icon: Bell },
		{ key: 'sms', icon: Smartphone },
	] as const

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className='flex h-[100dvh] max-h-[100dvh] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:h-[80vh] sm:max-h-[80vh]'>
				<Tabs
					value={activeTab}
					onValueChange={(value) => setActiveTab(value as SettingsTab)}
					orientation={isDesktop ? 'vertical' : 'horizontal'}
					className='flex min-h-0 flex-1 flex-col md:flex-row'
				>
					{/* Section nav: a scrollable tab row on mobile, a sidebar from md up */}
					<div className='flex shrink-0 flex-col border-b bg-muted/30 md:w-64 md:border-r md:border-b-0'>
						<DialogHeader className='p-4 pr-12 text-left md:border-b md:p-6 md:pb-4'>
							<DialogTitle>{t('title')}</DialogTitle>
						</DialogHeader>
						<TabsList
							aria-label={t('title')}
							className='flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-none bg-transparent px-2 pb-2 md:flex-1 md:flex-col md:items-stretch md:justify-start md:overflow-y-auto md:px-4 md:py-4'
						>
							{sidebarNavItems.map((item) => (
								<TabsTrigger
									key={item.id}
									value={item.id}
									className='h-10 shrink-0 justify-start gap-3 rounded-md px-3 text-muted-foreground hover:bg-muted hover:text-foreground data-[state=active]:bg-muted data-[state=active]:text-foreground data-[state=active]:shadow-none'
								>
									<item.icon className='h-4 w-4' aria-hidden='true' />
									{t(`tabs.${item.id}`)}
								</TabsTrigger>
							))}
						</TabsList>
						<div className='hidden border-t p-4 md:block'>
							<div className='flex items-center gap-3'>
								<Avatar className='h-9 w-9'>
									<AvatarImage src={session?.user.image || ''} alt='' />
									<AvatarFallback className='bg-primary text-xs text-primary-foreground'>
										{getInitials(session?.user.name || '', session?.user.lastName)}
									</AvatarFallback>
								</Avatar>
								<div className='grid min-w-0 gap-0.5 text-xs'>
									<span className='truncate font-medium'>{session?.user.name}</span>
									<span className='truncate text-muted-foreground'>{session?.user.email}</span>
								</div>
							</div>
						</div>
					</div>

					{/* Content */}
					<div className='min-h-0 flex-1 overflow-y-auto bg-background'>
						<div className='mx-auto max-w-2xl p-4 pb-12 sm:p-6 md:p-8'>
							<TabsContent value='general' className='mt-0 space-y-8'>
								<SettingsSection title={t('profile.title')} description={t('profile.description')}>
									<SettingRow
										id='setting-full-name'
										title={t('profile.fullName')}
										description={`${session?.user.name ?? ''} ${session?.user.lastName ?? ''}`.trim()}
									>
										<Button variant='outline' size='sm' aria-describedby='setting-full-name-label'>
											{t('actions.edit')}
										</Button>
									</SettingRow>
									<SettingRow id='setting-email' title={t('profile.email')} description={session?.user.email}>
										<Button variant='outline' size='sm' aria-describedby='setting-email-label'>
											{t('actions.change')}
										</Button>
									</SettingRow>
								</SettingsSection>

								<SettingsSection title={t('appearance.title')} description={t('appearance.description')}>
									<SettingRow
										id='setting-theme'
										icon={Palette}
										title={t('appearance.theme')}
										description={t('appearance.themeDescription')}
									>
										<fieldset aria-labelledby='setting-theme-label' className='min-w-0'>
											<ModeToggle />
										</fieldset>
									</SettingRow>
									<SettingRow
										id='setting-language'
										icon={Globe}
										title={t('appearance.language')}
										description={t('appearance.languageDescription')}
									>
										<fieldset aria-labelledby='setting-language-label' className='flex min-w-0 gap-2'>
											<Button
												variant={locale === 'es' ? 'default' : 'outline'}
												size='sm'
												aria-pressed={locale === 'es'}
												onClick={() => switchLocale('es')}
											>
												{tCommon('language.es')}
											</Button>
											<Button
												variant={locale === 'en' ? 'default' : 'outline'}
												size='sm'
												aria-pressed={locale === 'en'}
												onClick={() => switchLocale('en')}
											>
												{tCommon('language.en')}
											</Button>
										</fieldset>
									</SettingRow>
								</SettingsSection>

								<SettingsSection title={t('navigation.title')} description={t('navigation.description')}>
									<SettingRow
										id='setting-sidebar-hover'
										icon={Layout}
										title={t('navigation.sidebarHover')}
										description={t('navigation.sidebarHoverDescription')}
										controlId='sidebar-hover'
									>
										<Switch
											id='sidebar-hover'
											aria-describedby='setting-sidebar-hover-desc'
											checked={sidebarHoverEnabled}
											onCheckedChange={setSidebarHoverEnabled}
										/>
									</SettingRow>
								</SettingsSection>
							</TabsContent>

							<TabsContent value='security' className='mt-0 space-y-8'>
								<SettingsSection title={t('security.title')} description={t('security.description')}>
									<SettingRow
										id='setting-password'
										icon={Lock}
										title={t('security.password')}
										description={t('security.passwordUpdated')}
									>
										<Button variant='outline' size='sm' aria-describedby='setting-password-label'>
											{t('actions.change')}
										</Button>
									</SettingRow>
									<SettingRow
										id='setting-two-factor'
										icon={Shield}
										title={t('security.twoFactor')}
										description={t('security.twoFactorDescription')}
									>
										<Badge variant='outline' className='border-success/50 text-success'>
											{t('security.enabled')}
										</Badge>
									</SettingRow>
								</SettingsSection>

								<SettingsSection title={t('devices.title')} description={t('devices.description')}>
									<SettingRow
										id='setting-sessions'
										icon={Smartphone}
										title={t('devices.activeSessions')}
										description={t('devices.activeSessionsDescription')}
									>
										<Button variant='outline' size='sm' aria-describedby='setting-sessions-label'>
											{t('actions.manage')}
										</Button>
									</SettingRow>
								</SettingsSection>

								<PasskeyManager />
							</TabsContent>

							<TabsContent value='notifications' className='mt-0 space-y-8'>
								<SettingsSection title={t('notifications.title')} description={t('notifications.description')}>
									{notificationRows.map(({ key, icon }) => (
										<SettingRow
											key={key}
											id={`setting-${key}-notif`}
											icon={icon}
											title={t(`notifications.${key}`)}
											description={t(`notifications.${key}Description`)}
											controlId={`${key}-notif`}
										>
											<Switch
												id={`${key}-notif`}
												aria-describedby={`setting-${key}-notif-desc`}
												checked={notifications[key]}
												onCheckedChange={(checked) => setNotifications({ ...notifications, [key]: checked })}
											/>
										</SettingRow>
									))}
								</SettingsSection>
							</TabsContent>

							<TabsContent value='data' className='mt-0 space-y-8'>
								<SettingsSection title={t('data.title')} description={t('data.description')}>
									<SettingRow
										id='setting-export'
										icon={Download}
										title={t('data.export')}
										description={t('data.exportDescription')}
									>
										<Button variant='outline' size='sm' aria-describedby='setting-export-label'>
											{t('actions.exportCsv')}
										</Button>
									</SettingRow>
									<SettingRow
										id='setting-danger'
										title={t('data.dangerZone')}
										description={t('data.dangerZoneDescription')}
										danger
									>
										<Button variant='destructive' size='sm' aria-describedby='setting-danger-desc'>
											{t('actions.deleteAccount')}
										</Button>
									</SettingRow>
								</SettingsSection>
							</TabsContent>

							<TabsContent value='apikeys' className='mt-0'>
								<APIKeysSection />
							</TabsContent>
						</div>
					</div>
				</Tabs>
			</DialogContent>
		</Dialog>
	)
}
