'use client'

import { Check, Moon, Sun } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useTheme } from 'next-themes'

import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

const THEMES = ['light', 'dark', 'system'] as const

export function ModeToggle() {
	const t = useTranslations('common.theme')
	// `theme` (not resolvedTheme) here: it is the stored preference the menu selects.
	const { theme, setTheme } = useTheme()

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant='outline' size='icon' aria-label={t('toggle')}>
					<Sun
						className='h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0'
						aria-hidden='true'
					/>
					<Moon
						className='absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100'
						aria-hidden='true'
					/>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align='end'>
				{THEMES.map((value) => (
					<DropdownMenuItem key={value} onClick={() => setTheme(value)} className='justify-between gap-4'>
						{t(value)}
						{theme === value ? <Check className='h-4 w-4' aria-hidden='true' /> : null}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
