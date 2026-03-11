import SwiftUI
import Combine

// TODO: Extract generic CRUDViewModel<T> to eliminate ~300 duplicated lines across ViewModels
@MainActor
class BaseViewModel: ObservableObject {
    @Published var isLoading = false
    @Published var error: String?

    @Published var showErrorBanner = false
    @Published var errorBannerMessage = ""
    @Published var showToast = false
    @Published var toastType: ToastType = .success
    @Published var toastMessage = ""

    func showError(_ message: String) {
        error = message
        errorBannerMessage = message
        showErrorBanner = true
        HapticManager.shared.notification(.error)
    }

    func showSuccess(_ message: String) {
        toastType = .success
        toastMessage = message
        showToast = true
    }

    func showWarning(_ message: String) {
        toastType = .warning
        toastMessage = message
        showToast = true
    }

    func clearError() {
        error = nil
        showErrorBanner = false
    }

    // FIXME: error/errorBanner/toast state should be consolidated
    func performLoading<T>(_ operation: () async throws -> T) async rethrows -> T {
        isLoading = true
        defer { isLoading = false }
        return try await operation()
    }
}
