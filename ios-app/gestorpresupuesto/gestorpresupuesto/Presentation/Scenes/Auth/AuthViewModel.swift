import SwiftUI
import Combine

@MainActor
class AuthViewModel: ObservableObject {
    @Published var isAuthenticated = false
    @Published var isLoading = false
    @Published var error: String?
    @Published var user: User?
    
    @Published var showErrorBanner = false
    @Published var errorBannerMessage = ""
    @Published var showToast = false
    @Published var toastType: ToastType = .error
    @Published var toastMessage = ""
    
    private let authRepository: AuthRepository
    
    init(authRepository: AuthRepository = AuthRepositoryImpl()) {
        self.authRepository = authRepository
        checkAuthStatus()
    }
    
    func checkAuthStatus() {
        if KeychainTokenStorage().getAccessToken() != nil {
            isAuthenticated = true
            Task {
                await fetchProfile()
            }
        }
    }
    
    func login(email: String, password: String) async {
        isLoading = true
        error = nil
        
        do {
            user = try await authRepository.login(email: email, password: password)
            showSuccess("Bienvenido, \(user?.name ?? "")")
            
            try? await Task.sleep(nanoseconds: 500_000_000)
            
            isAuthenticated = true
        } catch {
            showError(error.localizedDescription)
        }
        
        isLoading = false
    }
    
    func register(name: String, lastName: String, email: String, password: String) async {
        isLoading = true
        error = nil
        
        do {
            let _ = try await authRepository.register(name: name, lastName: lastName, email: email, password: password)
            await login(email: email, password: password)
        } catch {
            showError(error.localizedDescription)
        }
        
        isLoading = false
    }
    
    func logout() async {
        isLoading = true
        
        do {
            try await authRepository.logout()
        } catch {
            print("Logout error: \(error)")
        }
        
        isAuthenticated = false
        user = nil
        isLoading = false
    }
    
    private func fetchProfile() async {
        do {
            user = try await authRepository.getProfile()
        } catch {
            print("Error fetching profile: \(error)")
        }
    }
    
    func showError(_ message: String) {
        error = message
        errorBannerMessage = message
        showErrorBanner = true
        
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(.error)
    }
    
    func showSuccess(_ message: String) {
        toastType = .success
        toastMessage = message
        showToast = true
    }
    
    func clearError() {
        error = nil
        showErrorBanner = false
    }
}
