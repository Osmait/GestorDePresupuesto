import Foundation
import Combine

@MainActor
class AccountsViewModel: BaseViewModel {
    @Published var accounts: [AccountResponse] = []

    private let accountRepository: AccountRepository

    init(accountRepository: AccountRepository? = nil) {
        self.accountRepository = accountRepository ?? DependencyContainer.shared.resolve(AccountRepository.self)
    }

    func loadAccounts() async {
        isLoading = true
        defer { isLoading = false }
        error = nil

        do {
            accounts = try await accountRepository.getAll()
        } catch {
            showError(error.localizedDescription)
        }
    }

    func createAccount(request: CreateAccountRequest) async throws {
        try await accountRepository.create(request)
        showSuccess("Cuenta creada")
        await loadAccounts()
    }

    func updateAccount(_ id: String, request: UpdateAccountRequest) async throws {
        try await accountRepository.update(id, request: request)
        showSuccess("Cuenta actualizada")
        await loadAccounts()
    }

    func deleteAccount(_ id: String) async {
        do {
            try await accountRepository.delete(id)
            accounts.removeAll { $0.accountInfo.id == id }
            showSuccess("Cuenta eliminada")
        } catch {
            showError(error.localizedDescription)
        }
    }
}
