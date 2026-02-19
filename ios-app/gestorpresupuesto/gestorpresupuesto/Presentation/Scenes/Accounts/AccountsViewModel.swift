import Foundation
import UIKit
import Combine

@MainActor
class AccountsViewModel: ObservableObject {
    @Published var accounts: [AccountResponse] = []
    @Published var isLoading = false
    @Published var error: String?
    
    @Published var showErrorBanner = false
    @Published var errorBannerMessage = ""
    @Published var showToast = false
    @Published var toastType: ToastType = .success
    @Published var toastMessage = ""
    
    private let accountRepository: AccountRepository
    
    init(accountRepository: AccountRepository = AccountRepositoryImpl()) {
        self.accountRepository = accountRepository
    }
    
    func loadAccounts() async {
        isLoading = true
        error = nil
        
        do {
            accounts = try await accountRepository.getAll()
        } catch {
            showError(error.localizedDescription)
        }
        
        isLoading = false
    }
    
    func createAccount(request: CreateAccountRequest) async throws -> Account {
        let account = try await accountRepository.create(request)
        showSuccess("Cuenta creada")
        await loadAccounts()
        return account
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
