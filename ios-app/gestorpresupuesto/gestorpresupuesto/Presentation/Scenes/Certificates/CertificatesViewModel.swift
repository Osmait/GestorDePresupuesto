import Foundation
import Combine

@MainActor
class CertificatesViewModel: BaseViewModel {
    @Published var certificates: [Certificate] = []
    @Published var summary: CertificateSummary?
    @Published var selectedCertificate: CertificateWithHistory?
    @Published var simulationResult: SimulationResult?
    @Published var accounts: [AccountResponse] = []

    private let certificateRepository: CertificateRepository
    private let accountRepository: AccountRepository

    init(
        certificateRepository: CertificateRepository? = nil,
        accountRepository: AccountRepository? = nil
    ) {
        let container = DependencyContainer.shared
        self.certificateRepository = certificateRepository ?? container.resolve(CertificateRepository.self)
        self.accountRepository = accountRepository ?? container.resolve(AccountRepository.self)
    }

    func loadCertificates() async {
        isLoading = true
        error = nil

        do {
            async let certsTask = certificateRepository.getAll()
            async let summaryTask = certificateRepository.getSummary()
            async let accountsTask = accountRepository.getAll()

            certificates = try await certsTask
            summary = try await summaryTask
            accounts = try await accountsTask
        } catch {
            showError(error.localizedDescription)
        }

        isLoading = false
    }

    func loadCertificateDetail(_ id: String) async {
        do {
            selectedCertificate = try await certificateRepository.getById(id)
        } catch {
            showError(error.localizedDescription)
        }
    }

    func createCertificate(request: CreateCertificateRequest) async throws -> Certificate {
        let cert = try await certificateRepository.create(request)
        showSuccess("Certificado creado")
        await loadCertificates()
        return cert
    }

    func deleteCertificate(_ id: String) async {
        do {
            try await certificateRepository.delete(id)
            certificates.removeAll { $0.id == id }
            showSuccess("Certificado eliminado")
        } catch {
            showError(error.localizedDescription)
        }
    }

    func simulate(id: String, request: SimulatePaymentRequest) async {
        do {
            simulationResult = try await certificateRepository.simulate(id: id, request: request)
        } catch {
            showError(error.localizedDescription)
        }
    }
}
