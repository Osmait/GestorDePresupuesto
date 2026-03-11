import Foundation
import Combine

@MainActor
class BudgetsViewModel: BaseViewModel {
    @Published var budgets: [BudgetResponse] = []

    private let budgetRepository: BudgetRepository

    init(budgetRepository: BudgetRepository? = nil) {
        self.budgetRepository = budgetRepository ?? DependencyContainer.shared.resolve(BudgetRepository.self)
    }

    func loadBudgets() async {
        isLoading = true
        defer { isLoading = false }
        error = nil

        do {
            budgets = try await budgetRepository.getAll()
        } catch {
            showError(error.localizedDescription)
        }
    }

    func createBudget(request: CreateBudgetRequest) async throws -> Budget {
        let budget = try await budgetRepository.create(request)
        showSuccess("Presupuesto creado")
        await loadBudgets()
        return budget
    }

    func updateBudget(_ id: String, request: UpdateBudgetRequest) async throws -> Budget {
        let budget = try await budgetRepository.update(id, request: request)
        showSuccess("Presupuesto actualizado")
        await loadBudgets()
        return budget
    }

    func deleteBudget(_ id: String) async {
        do {
            try await budgetRepository.delete(id)
            budgets.removeAll { $0.id == id }
            showSuccess("Presupuesto eliminado")
        } catch {
            showError(error.localizedDescription)
        }
    }
}
