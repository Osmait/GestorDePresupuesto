'use client'

import { useTranslations } from 'next-intl'
import { CategoryActions } from '@/components/categories/CategoryActions'
import { CategoryProvider } from '@/components/categories/CategoryContext'
import { CategoryList } from '@/components/categories/CategoryList'
import { PageHeader } from '@/components/shared/PageHeader'
import { PageShell } from '@/components/shared/PageShell'

export default function CategoriesPage() {
	const t = useTranslations('categories')
	return (
		<CategoryProvider>
			<PageShell>
				<div id='categories-header'>
					<PageHeader
						title={t('title')}
						description={t('subtitle')}
						actionsId='add-category-btn'
						actions={<CategoryActions />}
					/>
				</div>

				<div id='categories-list'>
					<CategoryList />
				</div>
			</PageShell>
		</CategoryProvider>
	)
}
