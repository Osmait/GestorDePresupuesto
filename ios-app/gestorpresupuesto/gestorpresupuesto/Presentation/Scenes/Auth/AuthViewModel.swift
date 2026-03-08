import SwiftUI
import Combine

@MainActor
class AuthViewModel: BaseViewModel {
    @Published var isAuthenticated = false
    @Published var user: User?

    private let authRepository: AuthRepository

    init(authRepository: AuthRepository? = nil) {
        self.authRepository = authRepository ?? DependencyContainer.shared.resolve(AuthRepository.self)
        super.init()
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

        await CacheManager.shared.invalidateAll()
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
}
