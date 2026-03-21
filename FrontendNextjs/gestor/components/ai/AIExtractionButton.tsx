'use client'

import { Sparkles } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { AIExtractionModal } from './AIExtractionModal'

interface AIExtractionButtonProps {
	accountId?: string
	variant?: 'default' | 'outline' | 'secondary' | 'ghost'
	size?: 'default' | 'sm' | 'lg' | 'icon'
	className?: string
}

export function AIExtractionButton({
	accountId,
	variant = 'outline',
	size = 'default',
	className,
}: AIExtractionButtonProps) {
	const t = useTranslations('ai.common')
	const [isOpen, setIsOpen] = useState(false)

	const isSmall = size === 'sm'

	return (
		<>
			<Button variant={variant} size={size} onClick={() => setIsOpen(true)} className={className}>
				<Sparkles className={`h-4 w-4 ${isSmall ? '' : 'mr-2'} sm:mr-2`} />
				<span className={`${isSmall ? 'hidden sm:inline' : ''}`}>{t('extractFromDocument')}</span>
			</Button>
			<AIExtractionModal open={isOpen} onOpenChange={setIsOpen} defaultAccountId={accountId} />
		</>
	)
}
