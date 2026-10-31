'use client'

import { useTranslations } from 'next-intl'
import { useCallback } from 'react'
import { buildUniqueCategoryName } from '@/lib/category-name'

/** buildUniqueCategoryName with the fallback name and the AI suffix in the user's language. */
export function useUniqueCategoryName() {
	const t = useTranslations('categories')
	return useCallback(
		(baseName: string, existingNames: string[]) =>
			buildUniqueCategoryName(baseName, existingNames, {
				fallback: t('suggestedNameFallback'),
				suffix: t('aiSuggestedSuffix'),
			}),
		[t],
	)
}
