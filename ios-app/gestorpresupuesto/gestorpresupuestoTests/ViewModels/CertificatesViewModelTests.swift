import Testing
@testable import gestorpresupuesto

@Suite("CertificatesViewModel Tests")
struct CertificatesViewModelTests {

    @MainActor private func makeSUT() -> (CertificatesViewModel, MockCertificateRepository, MockAccountRepository) {
        let certRepo = MockCertificateRepository()
        let accRepo = MockAccountRepository()
        let vm = CertificatesViewModel(
            certificateRepository: certRepo,
            accountRepository: accRepo
        )
        return (vm, certRepo, accRepo)
    }

    @Test @MainActor func loadCertificates_success() async {
        let (vm, certRepo, accRepo) = makeSUT()
        certRepo.getAllResult = .success([.fixture()])
        certRepo.getSummaryResult = .success(.fixture())
        accRepo.getAllResult = .success([.fixture()])

        await vm.loadCertificates()

        #expect(vm.certificates.count == 1)
        #expect(vm.summary != nil)
        #expect(vm.accounts.count == 1)
        #expect(!vm.isLoading)
    }

    @Test @MainActor func loadCertificates_error() async {
        let (vm, certRepo, _) = makeSUT()
        certRepo.getAllResult = .failure(MockError.forced)

        await vm.loadCertificates()

        #expect(vm.error != nil)
    }

    @Test @MainActor func createCertificate_success() async throws {
        let (vm, certRepo, accRepo) = makeSUT()
        certRepo.createResult = .success(.fixture())
        certRepo.getAllResult = .success([.fixture()])
        certRepo.getSummaryResult = .success(.fixture())
        accRepo.getAllResult = .success([])

        let cert = try await vm.createCertificate(request: CreateCertificateRequest(
            bank: "BHD", baseCapital: 100000,
            interestType: "compound", currentInterestRate: 12.5,
            currentTaxRate: 10, cutDay: 15,
            reinvestInterest: true, payoutAccountId: nil,
            maturityDate: nil, currency: "DOP"
        ))

        #expect(cert.bank == "BHD")
    }

    @Test @MainActor func deleteCertificate_success() async {
        let (vm, _, _) = makeSUT()
        vm.certificates = [.fixture(id: "cert-1")]

        await vm.deleteCertificate("cert-1")

        #expect(vm.certificates.isEmpty)
    }

    @Test @MainActor func deleteCertificate_error() async {
        let (vm, certRepo, _) = makeSUT()
        certRepo.deleteError = MockError.forced

        await vm.deleteCertificate("cert-1")

        #expect(vm.error != nil)
    }

    @Test @MainActor func simulate_success() async {
        let (vm, certRepo, _) = makeSUT()
        certRepo.simulateResult = .success(SimulationResult(
            payments: [],
            totals: SimulationTotals(grossInterest: 1000, taxWithheld: 100, netInterest: 900)
        ))

        await vm.simulate(id: "cert-1", request: SimulatePaymentRequest(
            capital: nil, rate: nil, taxRate: nil, months: 12
        ))

        #expect(vm.simulationResult != nil)
        #expect(vm.simulationResult?.totals.netInterest == 900)
    }

    @Test @MainActor func simulate_error() async {
        let (vm, certRepo, _) = makeSUT()
        certRepo.simulateResult = .failure(MockError.forced)

        await vm.simulate(id: "cert-1", request: SimulatePaymentRequest(
            capital: nil, rate: nil, taxRate: nil, months: nil
        ))

        #expect(vm.error != nil)
    }
}
