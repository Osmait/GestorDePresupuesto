import Combine
import SwiftUI

struct ReconciliationView: View {
    @StateObject private var viewModel = ReconciliationViewModel()
    @State private var selectedAccountId = ""

    var body: some View {
        NavigationStack {
            ZStack {
                Color.app.background.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: Spacing.lg.rawValue) {
                        SurfaceCard {
                            VStack(spacing: Spacing.md.rawValue) {
                                Text("Conciliación Bancaria")
                                    .font(.app(.headline))

                                Text("Sube un estado de cuenta para conciliar automáticamente con tus transacciones registradas.")
                                    .font(.app(.caption))
                                    .foregroundStyle(Color.app.textSecondary)
                                    .multilineTextAlignment(.center)
                            }
                        }

                        if viewModel.isLoading {
                            VStack(spacing: Spacing.md.rawValue) {
                                ForEach(0..<3, id: \.self) { _ in CardSkeleton() }
                            }
                        } else if viewModel.previewData == nil && !viewModel.isLoading {
                            EmptyStateView(
                                icon: "doc.text.magnifyingglass",
                                title: "Sin conciliación",
                                message: "Sube un estado de cuenta bancario para comenzar la conciliación automática."
                            )
                        }

                        if let preview = viewModel.previewData {
                            VStack(alignment: .leading, spacing: Spacing.md.rawValue) {
                                Text("Resultados: \(preview.extractedCount) transacciones")
                                    .font(.app(.headline))

                                if !preview.exactMatches.isEmpty {
                                    sectionHeader("Coincidencias exactas", count: preview.exactMatches.count, color: .app.success)
                                    ForEach(preview.exactMatches) { item in
                                        reconciliationItemRow(item)
                                    }
                                }

                                if !preview.similarMatches.isEmpty {
                                    sectionHeader("Similares", count: preview.similarMatches.count, color: .app.warning)
                                    ForEach(preview.similarMatches) { item in
                                        reconciliationItemRow(item)
                                    }
                                }

                                if !preview.unmatched.isEmpty {
                                    sectionHeader("Sin coincidencia", count: preview.unmatched.count, color: .app.error)
                                    ForEach(preview.unmatched) { item in
                                        reconciliationItemRow(item)
                                    }
                                }
                            }
                        }
                    }
                    .padding(Spacing.lg.rawValue)
                }
            }
            .navigationTitle("Conciliación")
            .notificationToolbar()
            .errorBanner(isPresented: $viewModel.showErrorBanner, message: viewModel.errorBannerMessage)
            .toast(isPresented: $viewModel.showToast, type: viewModel.toastType, message: viewModel.toastMessage)
        }
    }

    private func sectionHeader(_ title: String, count: Int, color: Color) -> some View {
        HStack {
            Text(title)
                .font(.app(.subheadline))
                .fontWeight(.medium)
            Spacer()
            Text("\(count)")
                .font(.app(.caption))
                .foregroundStyle(color)
        }
    }

    private func reconciliationItemRow(_ item: AIReconciliationItem) -> some View {
        SurfaceCard {
            VStack(alignment: .leading, spacing: Spacing.sm.rawValue) {
                HStack {
                    Text(item.extracted.name)
                        .font(.app(.subheadline))
                        .fontWeight(.medium)
                        .foregroundStyle(Color.app.textPrimary)
                    Spacer()
                    Text(item.extracted.amount.currencyFormatted)
                        .font(.app(.subheadline))
                        .fontWeight(.semibold)
                }
                Text("Score: \(String(format: "%.0f", item.score * 100))%")
                    .font(.caption2)
                    .foregroundStyle(Color.app.textTertiary)
            }
        }
    }
}

@MainActor
class ReconciliationViewModel: BaseViewModel {
    @Published var previewData: AIReconciliationPreviewData?
    @Published var sessionId: String?

    private let aiRepository: AIRepository

    init(aiRepository: AIRepository? = nil) {
        self.aiRepository = aiRepository ?? DependencyContainer.shared.resolve(AIRepository.self)
    }

    func preview(accountId: String, files: [DocumentFile]) async {
        isLoading = true
        error = nil

        let request = AIReconciliationPreviewRequest(
            accountId: accountId,
            accountCurrency: nil,
            documentType: "statement",
            language: "es",
            files: files
        )

        do {
            let response = try await aiRepository.reconcilePreview(request: request)
            previewData = response.data
            sessionId = response.data.sessionId
        } catch {
            showError(error.localizedDescription)
        }

        isLoading = false
    }

    func apply(actions: [AIReconciliationAction]) async {
        guard let sessionId = sessionId else { return }
        isLoading = true

        let request = AIReconciliationApplyRequest(actions: actions)

        do {
            let response = try await aiRepository.reconcileApply(sessionId: sessionId, request: request)
            showSuccess("Conciliación aplicada: \(response.data.created) creados, \(response.data.linked) vinculados")
        } catch {
            showError(error.localizedDescription)
        }

        isLoading = false
    }
}
