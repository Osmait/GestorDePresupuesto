import SwiftUI
import Combine

@MainActor
class AuthViewModel: BaseViewModel {
    @Published var isAuthenticated = false
    @Published var requiresBiometricUnlock = false
    @Published var showBiometricEnrollment = false
    @Published var user: User?

    private let authRepository: AuthRepository
    private let biometricService: BiometricAuthServiceProtocol
    private let userDefaults = UserDefaultsStorage.shared

    var isBiometricAvailable: Bool {
        biometricService.isBiometricAvailable
    }

    var biometricType: BiometricType {
        biometricService.biometricType
    }

    var isBiometricEnabled: Bool {
        userDefaults.biometricEnabled
    }

    init(
        authRepository: AuthRepository? = nil,
        biometricService: BiometricAuthServiceProtocol = BiometricAuthService()
    ) {
        self.authRepository = authRepository ?? DependencyContainer.shared.resolve(AuthRepository.self)
        self.biometricService = biometricService
        super.init()
        checkAuthStatus()
    }

    func checkAuthStatus() {
        if KeychainTokenStorage().getAccessToken() != nil {
            if userDefaults.biometricEnabled && biometricService.isBiometricAvailable {
                requiresBiometricUnlock = true
            } else {
                isAuthenticated = true
                Task {
                    await fetchProfile()
                }
            }
        }
    }

    func login(email: String, password: String) async {
        isLoading = true
        defer { isLoading = false }
        error = nil

        do {
            user = try await authRepository.login(email: email, password: password)
            showSuccess("Bienvenido, \(user?.name ?? "")")

            try? await Task.sleep(nanoseconds: 500_000_000)

            isAuthenticated = true
            offerBiometricEnrollmentIfNeeded()
        } catch {
            showError(error.localizedDescription)
        }
    }

    func register(name: String, lastName: String, email: String, password: String) async {
        isLoading = true
        defer { isLoading = false }
        error = nil

        do {
            _ = try await authRepository.register(name: name, lastName: lastName, email: email, password: password)
            await login(email: email, password: password)
        } catch {
            showError(error.localizedDescription)
        }
    }

    func logout() async {
        isLoading = true
        defer { isLoading = false }

        do {
            try await authRepository.logout()
        } catch {
            #if DEBUG
            print("Logout error: \(error)")
            #endif
        }

        isAuthenticated = false
        requiresBiometricUnlock = false
        user = nil
    }

    // MARK: - Biometric Auth

    func unlockWithBiometrics() async {
        do {
            let success = try await biometricService.authenticate(
                reason: "Desbloquea la app para acceder a tus finanzas"
            )
            if success {
                HapticManager.shared.notification(.success)
                requiresBiometricUnlock = false
                isAuthenticated = true
                await fetchProfile()
                // If profile fetch fails due to expired tokens, fall back to login
                if user == nil {
                    isAuthenticated = false
                }
            }
        } catch let error as BiometricError {
            HapticManager.shared.notification(.error)
            if error == .userCancelled {
                // User tapped "Usar contraseña" — do nothing, let them tap the button
            } else {
                showError(error.localizedDescription)
            }
        } catch {
            HapticManager.shared.notification(.error)
        }
    }

    func fallbackToPasswordLogin() {
        requiresBiometricUnlock = false
        isAuthenticated = false
    }

    func enableBiometric() {
        userDefaults.biometricEnabled = true
        userDefaults.biometricEnrollmentOffered = true
    }

    func disableBiometric() {
        userDefaults.biometricEnabled = false
    }

    private func offerBiometricEnrollmentIfNeeded() {
        guard biometricService.isBiometricAvailable,
              !userDefaults.biometricEnrollmentOffered else {
            return
        }
        showBiometricEnrollment = true
    }

    private func fetchProfile() async {
        do {
            user = try await authRepository.getProfile()
        } catch {
            #if DEBUG
            print("Error fetching profile: \(error)")
            #endif
        }
    }
}
