'use client'

import { CategoryProvider } from '@/components/categories/CategoryContext'
import { CategoryActions } from '@/components/categories/CategoryActions'
import { CategoryList } from '@/components/categories/CategoryList'
import { useTranslations } from 'next-intl'

export default function CategoriesPage() {
	const t = useTranslations('categories')
	return (
		<div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 dark:from-background dark:via-background dark:to-muted/20">
			<div className="container mx-auto px-4 py-8">
				<CategoryProvider>
					<div className="mb-8" id="categories-header">
						<div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
							<div>
								<h1 className="text-4xl font-bold tracking-tight text-foreground">
									{t('title')}
								</h1>
								<p className="text-muted-foreground mt-2 text-lg">
									{t('subtitle')}
								</p>
							</div>
							<div id="add-category-btn">
								<CategoryActions />
							</div>
						</div>
					</div>

					<div id="categories-list">
						<CategoryList />
					</div>
				</CategoryProvider>
			</div>
		</div>
	)
}

