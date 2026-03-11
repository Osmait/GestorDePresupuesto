import Testing
@testable import gestorpresupuesto

@Suite("AuthViewModel Tests")
struct AuthViewModelTests {

    @MainActor private func makeSUT(
        biometricAvailable: Bool = false,
        hasToken: Bool = false
    ) -> (AuthViewModel, MockAuthRepository, MockBiometricService) {
        let authRepo = MockAuthRepository()
        let bioService = MockBiometricService()
        bioService.isBiometricAvailable = biometricAvailable

        let vm = AuthViewModel(
            authRepository: authRepo,
            biometricService: bioService
        )
        return (vm, authRepo, bioService)
    }

    @Test @MainActor func login_success_authenticatesUser() async {
        let (vm, authRepo, _) = makeSUT()
        authRepo.loginResult = .success(.fixture(name: "José"))

        await vm.login(email: "test@test.com", password: "password")

        #expect(vm.user?.name == "José")
        #expect(!vm.isLoading)
    }

    @Test @MainActor func login_error_showsError() async {
        let (vm, authRepo, _) = makeSUT()
        authRepo.loginResult = .failure(MockError.forced)

        await vm.login(email: "test@test.com", password: "wrong")

        #expect(vm.error != nil)
        #expect(!vm.isLoading)
    }

    @Test @MainActor func logout_clearsState() async {
        let (vm, _, _) = makeSUT()
        vm.isAuthenticated = true
        vm.user = .fixture()

        await vm.logout()

        #expect(!vm.isAuthenticated)
        #expect(vm.user == nil)
    }

    @Test @MainActor func fallbackToPasswordLogin_clearsState() {
        let (vm, _, _) = makeSUT()
        vm.requiresBiometricUnlock = true

        vm.fallbackToPasswordLogin()

        #expect(!vm.requiresBiometricUnlock)
        #expect(!vm.isAuthenticated)
    }

    @Test @MainActor func isBiometricAvailable_delegatesToService() {
        let (vm, _, bioService) = makeSUT(biometricAvailable: true)
        #expect(vm.isBiometricAvailable)

        bioService.isBiometricAvailable = false
        #expect(!vm.isBiometricAvailable)
    }

    @Test @MainActor func biometricType_delegatesToService() {
        let (vm, _, bioService) = makeSUT()
        bioService.biometricType = .faceID
        #expect(vm.biometricType == .faceID)

        bioService.biometricType = .touchID
        #expect(vm.biometricType == .touchID)
    }

    @Test @MainActor func logout_callsRepository() async {
        let (vm, authRepo, _) = makeSUT()
        vm.isAuthenticated = true

        await vm.logout()

        #expect(authRepo.logoutCallCount == 1)
    }

    @Test @MainActor func login_callsRepository() async {
        let (vm, authRepo, _) = makeSUT()

        await vm.login(email: "test@test.com", password: "pass")

        #expect(authRepo.loginCallCount == 1)
    }
}
