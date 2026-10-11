'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { startTransition } from 'react'
import { ErrorState } from '@/components/shared/ErrorState'
import { PageShell } from '@/components/shared/PageShell'
import { Button } from '@/components/ui/button'

/**
 * Error boundary for every /app page. The sidebar and top bar (layout) stay
 * usable; only the page area shows the error with a retry.
 */
export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
	const t = useTranslations('common.error')
	const router = useRouter()

	function retry() {
		// Re-fetch server data for the segment, then re-render it.
		startTransition(() => {
			router.refresh()
			reset()
		})
	}

	return (
		<PageShell>
			<ErrorState
				title={t('pageTitle')}
				description={t('pageDescription')}
				onRetry={retry}
				action={
					<Button asChild variant='ghost'>
						<Link href='/app'>{t('goToDashboard')}</Link>
					</Button>
				}
			/>
		</PageShell>
	)
}
