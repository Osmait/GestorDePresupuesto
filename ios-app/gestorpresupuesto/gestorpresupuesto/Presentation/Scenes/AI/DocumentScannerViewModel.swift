import Foundation
import Combine
import SwiftUI
import Vision
import VisionKit

@MainActor
class DocumentScannerViewModel: BaseViewModel {
    @Published var isScanning = false
    @Published var isProcessing = false
    @Published var scannedImages: [UIImage] = []
    @Published var extractedTransactions: [ExtractedTransaction] = []
    @Published var selectedAccountId = ""
    @Published var documentType: DocumentType = .receipt

    private let aiRepository: AIRepository
    private let transactionRepository: TransactionRepository

    init(
        aiRepository: AIRepository? = nil,
        transactionRepository: TransactionRepository? = nil
    ) {
        let container = DependencyContainer.shared
        self.aiRepository = aiRepository ?? container.resolve(AIRepository.self)
        self.transactionRepository = transactionRepository ?? container.resolve(TransactionRepository.self)
    }

    var canExtract: Bool {
        !scannedImages.isEmpty && !selectedAccountId.isEmpty
    }

    func addScannedImage(_ image: UIImage) {
        scannedImages.append(image)
    }

    func removeScannedImage(at index: Int) {
        if scannedImages.indices.contains(index) {
            scannedImages.remove(at: index)
        }
    }

    func clearScannedImages() {
        scannedImages.removeAll()
        extractedTransactions.removeAll()
    }

    func extractTransactions() async {
        guard canExtract else { return }

        isProcessing = true

        do {
            var files: [DocumentFile] = []

            for (index, image) in scannedImages.enumerated() {
                if let base64Data = image.jpegData(compressionQuality: 0.8)?.base64EncodedString() {
                    files.append(DocumentFile(
                        filename: "document_\(index).jpg",
                        contentType: "image/jpeg",
                        base64Data: base64Data
                    ))
                }
            }

            let request = ExtractTransactionsRequest(
                accountId: selectedAccountId,
                documentType: documentType.rawValue,
                language: "es",
                files: files
            )

            let response = try await aiRepository.extractTransactions(request: request)
            extractedTransactions = response.data.transactions

            if extractedTransactions.isEmpty {
                showWarning("No se encontraron transacciones")
            } else {
                showSuccess("\(extractedTransactions.count) transacciones encontradas")
            }
        } catch {
            showError(error.localizedDescription)
        }

        isProcessing = false
    }

    func saveTransaction(_ extracted: ExtractedTransaction, categoryId: String, accountId: String) async -> Bool {
        let request = CreateTransactionRequest(
            name: extracted.name,
            description: extracted.description,
            amount: extracted.amount,
            typeTransaction: extracted.typeTransaction ?? "expense",
            accountId: accountId,
            categoryId: categoryId,
            budgetId: nil,
            currency: nil,
            createdAt: extracted.createdAt ?? Date()
        )

        do {
            try await transactionRepository.create(request)
            return true
        } catch {
            showError(error.localizedDescription)
            return false
        }
    }
}
