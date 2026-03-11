import Foundation
@testable import gestorpresupuesto

final class MockBiometricService: BiometricAuthServiceProtocol {
    var biometricType: BiometricType = .faceID
    var isBiometricAvailable: Bool = true
    var authenticateResult: Result<Bool, Error> = .success(true)
    var authenticateCallCount = 0

    func authenticate(reason: String) async throws -> Bool {
        authenticateCallCount += 1
        return try authenticateResult.get()
    }
}
