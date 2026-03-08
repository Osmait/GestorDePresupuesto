import Combine
import SwiftUI

struct SpendingAnalysisView: View {
    @StateObject private var viewModel = SpendingAnalysisViewModel()

    var body: some View {
        NavigationStack {
            ZStack {
                Color.app.background.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: Spacing.lg.rawValue) {
                        // Date Range
                        HStack(spacing: Spacing.md.rawValue) {
                            DatePickerField(title: "Desde", date: $viewModel.dateFrom)
                            DatePickerField(title: "Hasta", date: $viewModel.dateTo)
                        }

                        PrimaryButton("Analizar", isLoading: viewModel.isLoading) {
                            Task { await viewModel.analyze() }
                        }

                        if let insights = viewModel.insights {
                            // Summary
                            SurfaceCard {
                                VStack(spacing: Spacing.sm.rawValue) {
                                    Text("Resumen")
                                        .font(.app(.headline))
                                    HStack {
                                        VStack {
                                            Text("Ingresos")
                                                .font(.caption2)
                                                .foregroundStyle(Color.app.textTertiary)
                                            Text(insights.summary.totalIncome.currencyFormatted)
                                                .font(.app(.subheadline))
                                                .foregroundStyle(Color.app.success)
                                        }
                                        Spacer()
                                        VStack {
                                            Text("Gastos")
                                                .font(.caption2)
                                                .foregroundStyle(Color.app.textTertiary)
                                            Text(insights.summary.totalExpenses.currencyFormatted)
                                                .font(.app(.subheadline))
                                                .foregroundStyle(Color.app.error)
                                        }
                                        Spacer()
                                        VStack {
                                            Text("Ahorro")
                                                .font(.caption2)
                                                .foregroundStyle(Color.app.textTertiary)
                                            Text("\(String(format: "%.1f", insights.summary.savingsRatePercent))%")
                                                .font(.app(.subheadline))
                                                .fontWeight(.bold)
                                        }
                                    }
                                }
                            }

                            // Patterns
                            if !insights.patterns.isEmpty {
                                VStack(alignment: .leading, spacing: Spacing.md.rawValue) {
                                    Text("Patrones Detectados")
                                        .font(.app(.headline))
                                        .foregroundStyle(Color.app.textPrimary)

                                    ForEach(insights.patterns) { pattern in
                                        SurfaceCard {
                                            HStack(spacing: Spacing.md.rawValue) {
                                                Image(systemName: pattern.icon)
                                                    .foregroundStyle(pattern.severityColor)
                                                    .frame(width: 32)
                                                VStack(alignment: .leading, spacing: 2) {
                                                    Text(pattern.type.capitalized)
                                                        .font(.app(.subheadline))
                                                        .fontWeight(.medium)
                                                    Text(pattern.description)
                                                        .font(.app(.caption))
                                                        .foregroundStyle(Color.app.textSecondary)
                                                }
                                            }
                                        }
                                    }
                                }
                            }

                            // Recommendations
                            if !insights.recommendations.isEmpty {
                                VStack(alignment: .leading, spacing: Spacing.md.rawValue) {
                                    Text("Recomendaciones")
                                        .font(.app(.headline))
                                        .foregroundStyle(Color.app.textPrimary)

                                    ForEach(insights.recommendations) { rec in
                                        SurfaceCard {
                                            VStack(alignment: .leading, spacing: Spacing.sm.rawValue) {
                                                HStack {
                                                    Image(systemName: rec.priorityIcon)
                                                        .foregroundStyle(rec.priorityColor)
                                                    Text(rec.title)
                                                        .font(.app(.subheadline))
                                                        .fontWeight(.medium)
                                                }
                                                Text(rec.description)
                                                    .font(.app(.caption))
                                                    .foregroundStyle(Color.app.textSecondary)
                                                if rec.potentialSavings > 0 {
                                                    Text("Ahorro potencial: \(rec.potentialSavings.currencyFormatted)")
                                                        .font(.caption2)
                                                        .foregroundStyle(Color.app.success)
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    .padding(Spacing.lg.rawValue)
                }
            }
            .navigationTitle("Análisis de Gastos")
            .errorBanner(isPresented: $viewModel.showErrorBanner, message: viewModel.errorBannerMessage)
        }
    }
}

@MainActor
class SpendingAnalysisViewModel: BaseViewModel {
    @Published var dateFrom: Date = Calendar.current.date(byAdding: .month, value: -1, to: Date()) ?? Date()
    @Published var dateTo: Date = Date()
    @Published var insights: SpendingInsights?

    private let aiRepository: AIRepository

    init(aiRepository: AIRepository? = nil) {
        self.aiRepository = aiRepository ?? DependencyContainer.shared.resolve(AIRepository.self)
    }

    func analyze() async {
        isLoading = true
        error = nil

        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"

        let request = AnalyzeSpendingRequest(
            dateFrom: formatter.string(from: dateFrom),
            dateTo: formatter.string(from: dateTo),
            language: "es"
        )

        do {
            let response = try await aiRepository.analyzeSpending(request: request)
            insights = response.data
        } catch {
            showError(error.localizedDescription)
        }

        isLoading = false
    }
}
