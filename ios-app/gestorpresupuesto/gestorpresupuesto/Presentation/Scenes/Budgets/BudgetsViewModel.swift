import Foundation
import UIKit
import Combine

@MainActor
class BudgetsViewModel: ObservableObject {
    @Published var budgets: [BudgetResponse] = []
    @Published var isLoading = false
    @Published var error: String?
    
    @Published var showErrorBanner = false
    @Published var errorBannerMessage = ""
    @Published var showToast = false
    @Published var toastType: ToastType = .success
    @Published var toastMessage = ""
    
    private let budgetRepository: BudgetRepository
    
    init(budgetRepository: BudgetRepository = BudgetRepositoryImpl()) {
        self.budgetRepository = budgetRepository
    }
    
    func loadBudgets() async {
        isLoading = true
        error = nil
        
        do {
            budgets = try await budgetRepository.getAll()
        } catch {
            showError(error.localizedDescription)
        }
        
        isLoading = false
    }
    
    func createBudget(request: CreateBudgetRequest) async throws -> Budget {
        let budget = try await budgetRepository.create(request)
        showSuccess("Presupuesto creado")
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
    
    private func showError(_ message: String) {
        error = message
        errorBannerMessage = message
        showErrorBanner = true
        
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(.error)
    }
    
    private func showSuccess(_ message: String) {
        toastType = .success
        toastMessage = message
        showToast = true
    }
}
