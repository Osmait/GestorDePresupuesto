import { AnalysisProvider } from '@/components/analysis/AnalysisContext'
import { AnalysisActions } from '@/components/analysis/AnalysisActions'
import { AnalysisDashboard } from '@/components/analysis/AnalysisDashboard'

export default function AnalysisPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 dark:from-background dark:via-background dark:to-muted/20">
      <div className="container mx-auto px-4 py-8">
        <AnalysisProvider>
          {/* Header Estático - Server Side + Acciones Client Side */}
          <div className="mb-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-foreground via-primary to-primary bg-clip-text text-transparent">
                  Analíticas
                </h1>
                <p className="text-muted-foreground mt-2 text-lg">
                  Visualiza y explora tus datos financieros con filtros avanzados
                </p>
              </div>
              {/* Acciones */}
              <AnalysisActions />
            </div>
          </div>

          {/* Contenido Dinámico */}
          <AnalysisDashboard />
        </AnalysisProvider>
      </div>
    </div>
  )
}
