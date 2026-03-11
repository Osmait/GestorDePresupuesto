import Foundation
import Combine
import SwiftUI
import VisionKit
import PhotosUI
import PDFKit

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
            let images = scannedImages
            let files: [DocumentFile] = await Task.detached {
                var result: [DocumentFile] = []
                for (index, image) in images.enumerated() {
                    let resized = Self.downsampleIfNeeded(image)
                    if let base64Data = resized.jpegData(compressionQuality: 0.8)?.base64EncodedString() {
                        result.append(DocumentFile(
                            filename: "document_\(index).jpg",
                            contentType: "image/jpeg",
                            base64Data: base64Data
                        ))
                    }
                }
                return result
            }.value

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

    func handlePhotoPicker(_ items: [PhotosPickerItem]) async {
        for item in items {
            if let data = try? await item.loadTransferable(type: Data.self),
               let image = UIImage(data: data) {
                scannedImages.append(image)
            }
        }
    }

    func handleFileImport(_ result: Result<[URL], Error>) async {
        switch result {
        case .success(let urls):
            for url in urls {
                guard url.startAccessingSecurityScopedResource() else { continue }
                defer { url.stopAccessingSecurityScopedResource() }

                if url.pathExtension.lowercased() == "pdf" {
                    await loadPDFPages(from: url)
                } else if let data = try? Data(contentsOf: url),
                          let image = UIImage(data: data) {
                    scannedImages.append(image)
                }
            }
        case .failure(let error):
            showError(error.localizedDescription)
        }
    }

    private func loadPDFPages(from url: URL) async {
        guard let document = PDFDocument(url: url) else {
            showError("No se pudo abrir el PDF")
            return
        }

        let pageCount = document.pageCount
        let renderedImages: [UIImage] = await Task.detached {
            var images: [UIImage] = []
            for i in 0..<pageCount {
                guard let page = document.page(at: i) else { continue }
                let bounds = page.bounds(for: .mediaBox)
                let scale: CGFloat = 2.0
                let size = CGSize(width: bounds.width * scale, height: bounds.height * scale)

                let renderer = UIGraphicsImageRenderer(size: size)
                let image = renderer.image { ctx in
                    UIColor.white.setFill()
                    ctx.fill(CGRect(origin: .zero, size: size))
                    ctx.cgContext.translateBy(x: 0, y: size.height)
                    ctx.cgContext.scaleBy(x: scale, y: -scale)
                    page.draw(with: .mediaBox, to: ctx.cgContext)
                }
                images.append(Self.downsampleIfNeeded(image))
            }
            return images
        }.value

        scannedImages.append(contentsOf: renderedImages)
    }

    nonisolated private static func downsampleIfNeeded(_ image: UIImage, maxDimension: CGFloat = 4096) -> UIImage {
        let size = image.size
        guard size.width > maxDimension || size.height > maxDimension else { return image }

        let scale = maxDimension / max(size.width, size.height)
        let newSize = CGSize(width: size.width * scale, height: size.height * scale)

        let renderer = UIGraphicsImageRenderer(size: newSize)
        return renderer.image { _ in
            image.draw(in: CGRect(origin: .zero, size: newSize))
        }
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
