'use client'

import { AnalysisProvider } from '@/components/analysis/AnalysisContext'
import { AnalysisActions } from '@/components/analysis/AnalysisActions'
import { AnalysisDashboard } from '@/components/analysis/AnalysisDashboard'
import { useTranslations } from 'next-intl'

export default function AnalysisPage() {
  const t = useTranslations('analysis')

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 dark:from-background dark:via-background dark:to-muted/20">
      <div className="container mx-auto px-4 py-8">
        <AnalysisProvider>
          {/* Header */}
          <div className="mb-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h1 className="text-4xl font-bold tracking-tight text-foreground">
                  {t('title')}
                </h1>
                <p className="text-muted-foreground mt-2 text-lg">
                  {t('subtitle')}
                </p>
              </div>
              <AnalysisActions />
            </div>
          </div>

          <AnalysisDashboard />
        </AnalysisProvider>
      </div>
    </div>
  )
}

