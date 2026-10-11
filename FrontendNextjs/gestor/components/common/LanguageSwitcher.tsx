'use client'

import { Check, Globe } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'

import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { switchLocale } from '@/lib/i18n/switch-locale'

const LOCALES = ['es', 'en'] as const

export function LanguageSwitcher() {
	const t = useTranslations('common.language')
	const locale = useLocale()

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant='outline' size='icon' aria-label={t('switch')}>
					<Globe className='h-[1.2rem] w-[1.2rem]' aria-hidden='true' />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align='end'>
				{LOCALES.map((value) => (
					<DropdownMenuItem
						key={value}
						lang={value}
						onClick={() => switchLocale(value)}
						className='justify-between gap-4'
					>
						{t(value)}
						{locale === value ? <Check className='h-4 w-4' aria-hidden='true' /> : null}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
