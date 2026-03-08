import LocalAuthentication

enum BiometricType {
    case faceID
    case touchID
    case none
}

enum BiometricError: Error, LocalizedError {
    case notAvailable
    case authenticationFailed
    case userCancelled
    case biometryLockout

    var errorDescription: String? {
        switch self {
        case .notAvailable:
            return "La autenticación biométrica no está disponible en este dispositivo."
        case .authenticationFailed:
            return "La autenticación biométrica falló."
        case .userCancelled:
            return "La autenticación fue cancelada."
        case .biometryLockout:
            return "La autenticación biométrica está bloqueada. Usa tu contraseña para desbloquear."
        }
    }
}

protocol BiometricAuthServiceProtocol {
    var biometricType: BiometricType { get }
    var isBiometricAvailable: Bool { get }
    func authenticate(reason: String) async throws -> Bool
}

class BiometricAuthService: BiometricAuthServiceProtocol {
    var biometricType: BiometricType {
        let context = LAContext()
        var error: NSError?

        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            return .none
        }

        switch context.biometryType {
        case .faceID:
            return .faceID
        case .touchID:
            return .touchID
        default:
            return .none
        }
    }

    var isBiometricAvailable: Bool {
        biometricType != .none
    }

    func authenticate(reason: String) async throws -> Bool {
        let context = LAContext()
        context.localizedCancelTitle = "Usar contraseña"

        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            throw mapError(error)
        }

        do {
            let success = try await context.evaluatePolicy(
                .deviceOwnerAuthenticationWithBiometrics,
                localizedReason: reason
            )
            return success
        } catch let laError as LAError {
            switch laError.code {
            case .userCancel, .appCancel, .systemCancel:
                throw BiometricError.userCancelled
            case .biometryLockout:
                throw BiometricError.biometryLockout
            default:
                throw BiometricError.authenticationFailed
            }
        }
    }

    private func mapError(_ error: NSError?) -> BiometricError {
        guard let laError = error as? LAError else {
            return .notAvailable
        }

        switch laError.code {
        case .biometryLockout:
            return .biometryLockout
        default:
            return .notAvailable
        }
    }
}
