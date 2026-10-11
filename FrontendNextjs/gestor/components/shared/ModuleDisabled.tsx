import { PowerOff } from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { EmptyState } from './EmptyState'
import { PageHeader } from './PageHeader'
import { PageShell } from './PageShell'

export interface ModuleDisabledProps {
	/** The module's page title ("Inversiones"); stays the page h1. */
	title: ReactNode
}

/**
 * Whole-page state for a module turned off by a feature flag: the normal page
 * title plus an explanation and a link back to the dashboard.
 * Server-compatible (also fine inside client pages).
 *
 * @example
 * if (!isEnabled('module_loans')) return <ModuleDisabled title={t('title')} />
 */
export function ModuleDisabled({ title }: ModuleDisabledProps) {
	const t = useTranslations('common.moduleDisabled')
	return (
		<PageShell>
			<PageHeader title={title} />
			<EmptyState
				icon={PowerOff}
				title={t('title')}
				description={t('message')}
				action={
					<Button asChild variant='outline'>
						<Link href='/app'>{t('goToDashboard')}</Link>
					</Button>
				}
			/>
		</PageShell>
	)
}
