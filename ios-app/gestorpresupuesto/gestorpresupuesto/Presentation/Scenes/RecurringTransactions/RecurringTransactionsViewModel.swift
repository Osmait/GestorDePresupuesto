import Foundation
import Combine

@MainActor
class RecurringTransactionsViewModel: BaseViewModel {
    @Published var recurringTransactions: [RecurringTransaction] = []

    private let recurringRepository: RecurringTransactionRepository

    init(recurringRepository: RecurringTransactionRepository? = nil) {
        self.recurringRepository = recurringRepository ?? DependencyContainer.shared.resolve(RecurringTransactionRepository.self)
    }

    func loadRecurringTransactions() async {
        isLoading = true
        error = nil

        do {
            recurringTransactions = try await recurringRepository.getAll()
        } catch {
            showError(error.localizedDescription)
        }

        isLoading = false
    }

    func createRecurringTransaction(request: CreateRecurringTransactionRequest) async throws -> RecurringTransaction {
        let recurring = try await recurringRepository.create(request)
        showSuccess("Transacción recurrente creada")
        await loadRecurringTransactions()
        return recurring
    }

    func updateRecurringTransaction(_ id: String, request: UpdateRecurringTransactionRequest) async throws -> RecurringTransaction {
        let recurring = try await recurringRepository.update(id, request: request)
        showSuccess("Transacción recurrente actualizada")
        await loadRecurringTransactions()
        return recurring
    }

    func deleteRecurringTransaction(_ id: String) async {
        do {
            try await recurringRepository.delete(id)
            recurringTransactions.removeAll { $0.id == id }
            showSuccess("Transacción recurrente eliminada")
        } catch {
            showError(error.localizedDescription)
        }
    }

    var incomeTransactions: [RecurringTransaction] {
        recurringTransactions.filter { $0.isIncome }
    }

    var billTransactions: [RecurringTransaction] {
        recurringTransactions.filter { !$0.isIncome }
    }

    var totalIncome: Double {
        incomeTransactions.reduce(0) { $0 + $1.amount }
    }

    var totalBills: Double {
        billTransactions.reduce(0) { $0 + $1.amount }
    }
}
