import Combine
import SwiftUI

struct SavingsGoalsView: View {
    @StateObject private var viewModel = SavingsGoalsViewModel()
    @State private var showAddGoal = false

    var body: some View {
        NavigationStack {
            ZStack {
                Color.app.background.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: Spacing.lg.rawValue) {
                        if viewModel.goals.isEmpty && !viewModel.isLoading {
                            EmptyStateView(
                                icon: "target",
                                title: "Sin metas de ahorro",
                                message: "Crea tu primera meta de ahorro con ayuda de IA"
                            )
                        } else {
                            ForEach(viewModel.goals) { goal in
                                SurfaceCard {
                                    VStack(alignment: .leading, spacing: Spacing.md.rawValue) {
                                        HStack {
                                            Text(goal.name)
                                                .font(.app(.headline))
                                                .foregroundStyle(Color.app.textPrimary)
                                            Spacer()
                                            Text("\(String(format: "%.0f", goal.progressPct))%")
                                                .font(.app(.caption))
                                                .fontWeight(.bold)
                                                .foregroundStyle(goal.progressPct >= 100 ? Color.app.success : Color.app.accent)
                                        }

                                        GradientProgressBar(
                                            progress: min(goal.progressPct / 100, 1.0),
                                            height: 8,
                                            showLabel: false
                                        )

                                        HStack {
                                            VStack(alignment: .leading) {
                                                Text("Ahorrado")
                                                    .font(.caption2)
                                                    .foregroundStyle(Color.app.textTertiary)
                                                Text(goal.currentSaved.currencyFormatted)
                                                    .font(.app(.subheadline))
                                                    .fontWeight(.semibold)
                                            }
                                            Spacer()
                                            VStack(alignment: .trailing) {
                                                Text("Meta")
                                                    .font(.caption2)
                                                    .foregroundStyle(Color.app.textTertiary)
                                                Text(goal.targetAmount.currencyFormatted)
                                                    .font(.app(.subheadline))
                                            }
                                        }

                                        if let targetDate = goal.targetDate {
                                            Text("Fecha meta: \(targetDate)")
                                                .font(.caption2)
                                                .foregroundStyle(Color.app.textTertiary)
                                        }
                                    }
                                }
                                .swipeActions(edge: .trailing) {
                                    Button(role: .destructive) {
                                        Task { await viewModel.deleteGoal(goal.id) }
                                    } label: {
                                        Label("Eliminar", systemImage: "trash")
                                    }
                                }
                            }
                        }
                    }
                    .padding(Spacing.lg.rawValue)
                }
            }
            .navigationTitle("Metas de Ahorro")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button { showAddGoal = true } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $showAddGoal) {
                AddSavingsGoalView(viewModel: viewModel)
            }
            .refreshable { await viewModel.loadGoals() }
            .task { await viewModel.loadGoals() }
            .errorBanner(isPresented: $viewModel.showErrorBanner, message: viewModel.errorBannerMessage)
            .toast(isPresented: $viewModel.showToast, type: viewModel.toastType, message: viewModel.toastMessage)
        }
    }
}

struct AddSavingsGoalView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var viewModel: SavingsGoalsViewModel

    @State private var name = ""
    @State private var targetAmount = ""
    @State private var targetDate = Date()
    @State private var hasTargetDate = false

    private var isValid: Bool {
        name.isNotBlank && Double(targetAmount) != nil && (Double(targetAmount) ?? 0) > 0
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.app.background.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: Spacing.lg.rawValue) {
                        FormField(title: "Nombre de la meta", icon: "target", placeholder: "Ej: Vacaciones", text: $name)
                        FormField(title: "Monto objetivo", icon: "dollarsign.circle", placeholder: "0.00", text: $targetAmount, keyboardType: .decimalPad)

                        Toggle(isOn: $hasTargetDate) {
                            Text("Establecer fecha meta")
                                .font(.app(.subheadline))
                        }
                        .tint(Color.app.accent)
                        .padding(.horizontal, Spacing.md.rawValue)

                        if hasTargetDate {
                            DatePickerField(title: "Fecha meta", date: $targetDate)
                        }
                    }
                    .padding(Spacing.lg.rawValue)
                }
            }
            .navigationTitle("Nueva Meta")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Crear") { Task { await save() } }
                        .disabled(!isValid || viewModel.isLoading)
                }
            }
        }
    }

    private func save() async {
        guard let amount = Double(targetAmount) else { return }
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"

        let request = AICreateSavingsGoalRequest(
            name: name,
            targetAmount: amount,
            targetDate: hasTargetDate ? formatter.string(from: targetDate) : nil,
            accountId: nil,
            currentSaved: nil
        )

        do {
            _ = try await viewModel.createGoal(request: request)
            dismiss()
        } catch {
            viewModel.showError(error.localizedDescription)
        }
    }
}

@MainActor
class SavingsGoalsViewModel: BaseViewModel {
    @Published var goals: [AISavingsGoal] = []

    private let aiRepository: AIRepository

    init(aiRepository: AIRepository? = nil) {
        self.aiRepository = aiRepository ?? DependencyContainer.shared.resolve(AIRepository.self)
    }

    func loadGoals() async {
        isLoading = true
        error = nil

        do {
            goals = try await aiRepository.getSavingsGoals()
        } catch {
            showError(error.localizedDescription)
        }

        isLoading = false
    }

    func createGoal(request: AICreateSavingsGoalRequest) async throws -> AISavingsGoalResponse {
        let response = try await aiRepository.createSavingsGoal(request: request)
        showSuccess("Meta creada")
        await loadGoals()
        return response
    }

    func deleteGoal(_ id: String) async {
        do {
            try await aiRepository.deleteSavingsGoal(id: id)
            goals.removeAll { $0.id == id }
            showSuccess("Meta eliminada")
        } catch {
            showError(error.localizedDescription)
        }
    }
}
