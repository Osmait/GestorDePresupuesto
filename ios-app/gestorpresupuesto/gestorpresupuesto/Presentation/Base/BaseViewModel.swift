import SwiftUI
import Combine

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
}
