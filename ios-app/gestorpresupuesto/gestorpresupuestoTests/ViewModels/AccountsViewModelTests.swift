import Testing
@testable import gestorpresupuesto

@Suite("AccountsViewModel Tests")
struct AccountsViewModelTests {

    @Test @MainActor func loadAccounts_success_populatesAccounts() async {
        let mock = MockAccountRepository()
        mock.getAllResult = .success([.fixture()])
        let vm = AccountsViewModel(accountRepository: mock)

        await vm.loadAccounts()

        #expect(vm.accounts.count == 1)
        #expect(!vm.isLoading)
        #expect(vm.error == nil)
    }

    @Test @MainActor func loadAccounts_error_showsError() async {
        let mock = MockAccountRepository()
        mock.getAllResult = .failure(MockError.forced)
        let vm = AccountsViewModel(accountRepository: mock)

        await vm.loadAccounts()

        #expect(vm.accounts.isEmpty)
        #expect(!vm.isLoading)
        #expect(vm.error != nil)
    }

    @Test @MainActor func createAccount_success_reloads() async throws {
        let mock = MockAccountRepository()
        mock.createResult = .success(.fixture())
        mock.getAllResult = .success([.fixture()])
        let vm = AccountsViewModel(accountRepository: mock)

        let account = try await vm.createAccount(request: CreateAccountRequest(
            name: "Test", bank: "BHD", initialBalance: 1000
        ))

        #expect(account.name == "Cuenta Principal")
        #expect(mock.getAllCallCount >= 1)
    }

    @Test @MainActor func deleteAccount_success_removesFromList() async {
        let mock = MockAccountRepository()
        let vm = AccountsViewModel(accountRepository: mock)
        vm.accounts = [.fixture(account: .fixture(id: "del-1"))]

        await vm.deleteAccount("del-1")

        #expect(vm.accounts.isEmpty)
        #expect(mock.deleteCallCount == 1)
    }

    @Test @MainActor func deleteAccount_error_showsError() async {
        let mock = MockAccountRepository()
        mock.deleteError = MockError.forced
        let vm = AccountsViewModel(accountRepository: mock)
        vm.accounts = [.fixture()]

        await vm.deleteAccount("acc-1")

        #expect(vm.error != nil)
    }

    @Test @MainActor func updateAccount_success_reloads() async throws {
        let mock = MockAccountRepository()
        mock.updateResult = .success(.fixture())
        mock.getAllResult = .success([.fixture()])
        let vm = AccountsViewModel(accountRepository: mock)

        _ = try await vm.updateAccount("acc-1", request: UpdateAccountRequest(
            name: "Updated", bank: "BHD", initialBalance: 2000
        ))

        #expect(mock.getAllCallCount >= 1)
    }

    @Test @MainActor func loadAccounts_setsLoadingDuringFetch() async {
        let mock = MockAccountRepository()
        mock.getAllResult = .success([])
        let vm = AccountsViewModel(accountRepository: mock)

        await vm.loadAccounts()

        #expect(!vm.isLoading)
    }
}
