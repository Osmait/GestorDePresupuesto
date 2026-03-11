import SwiftUI
import VisionKit
import PhotosUI

struct DocumentScannerView: View {
    @StateObject private var viewModel = DocumentScannerViewModel()
    @StateObject private var accountsViewModel = AccountsViewModel()
    @StateObject private var categoriesViewModel = CategoriesViewModel()
    @State private var showDocumentCamera = false
    @State private var showSourcePicker = false
    @State private var showFilePicker = false
    @State private var selectedPhotoItems: [PhotosPickerItem] = []
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack {
            Color.app.background.ignoresSafeArea()

            ScrollView {
                VStack(spacing: .lg) {
                    if viewModel.scannedImages.isEmpty {
                        EmptyScannerState(onAction: { showSourcePicker = true })
                    } else {
                        ScannedImagesSection(
                            images: viewModel.scannedImages,
                            onAddMore: { showSourcePicker = true },
                            onRemove: { index in viewModel.removeScannedImage(at: index) },
                            onClear: { viewModel.clearScannedImages() }
                        )

                        DocumentTypeSelector(selectedType: $viewModel.documentType)

                        if accountsViewModel.accounts.isEmpty {
                            HStack {
                                Image(systemName: "exclamationmark.triangle")
                                    .foregroundStyle(Color.app.warning)
                                Text("No hay cuentas disponibles")
                                    .font(.caption)
                                    .foregroundStyle(Color.app.textSecondary)
                            }
                        } else {
                            DropdownPicker(
                                title: "Cuenta destino",
                                selection: $viewModel.selectedAccountId,
                                options: accountsViewModel.accounts.map { $0.accountInfo.id },
                                labelForOption: { id in
                                    if id.isEmpty { return "Seleccionar cuenta" }
                                    return accountsViewModel.accounts
                                        .first(where: { $0.accountInfo.id == id })
                                        .map { "\($0.accountInfo.name) - \($0.accountInfo.bank)" } ?? id
                                },
                                icon: "building.columns"
                            )
                        }

                        ExtractButton(
                            isEnabled: viewModel.canExtract,
                            isProcessing: viewModel.isProcessing
                        ) {
                            Task { await viewModel.extractTransactions() }
                        }

                        if !viewModel.extractedTransactions.isEmpty {
                            ExtractedTransactionsSection(
                                transactions: viewModel.extractedTransactions,
                                categories: categoriesViewModel.categories,
                                selectedAccountId: viewModel.selectedAccountId,
                                onSave: { transaction, categoryId in
                                    Task {
                                        _ = await viewModel.saveTransaction(
                                            transaction,
                                            categoryId: categoryId,
                                            accountId: viewModel.selectedAccountId
                                        )
                                    }
                                }
                            )
                        }
                    }
                }
                .padding()
            }
        }
        .navigationTitle("Escanear Documento")
        .navigationBarTitleDisplayMode(.inline)
        .notificationToolbar()
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button("Cerrar") { dismiss() }
                    .foregroundStyle(Color.app.textSecondary)
            }
        }
        .confirmationDialog("Agregar documento", isPresented: $showSourcePicker) {
            Button {
                showDocumentCamera = true
            } label: {
                Label("Escanear con cámara", systemImage: "camera.fill")
            }

            PhotosPicker(
                selection: $selectedPhotoItems,
                maxSelectionCount: 10,
                matching: .images
            ) {
                Label("Elegir de galería", systemImage: "photo.on.rectangle")
            }

            Button {
                showFilePicker = true
            } label: {
                Label("Elegir archivo", systemImage: "folder.fill")
            }

            Button("Cancelar", role: .cancel) {}
        }
        .sheet(isPresented: $showDocumentCamera) {
            DocumentCameraView { image in
                if let image = image {
                    viewModel.addScannedImage(image)
                }
            }
        }
        .fileImporter(
            isPresented: $showFilePicker,
            allowedContentTypes: [.image, .pdf],
            allowsMultipleSelection: true
        ) { result in
            Task { await viewModel.handleFileImport(result) }
        }
        .onChange(of: selectedPhotoItems) { _, items in
            guard !items.isEmpty else { return }
            Task {
                await viewModel.handlePhotoPicker(items)
                selectedPhotoItems = []
            }
        }
        .task {
            await accountsViewModel.loadAccounts()
            await categoriesViewModel.loadCategories()
        }
        .errorBanner(isPresented: $viewModel.showErrorBanner, message: viewModel.errorBannerMessage)
        .toast(isPresented: $viewModel.showToast, type: viewModel.toastType, message: viewModel.toastMessage)
    }
}

struct EmptyScannerState: View {
    let onAction: () -> Void

    var body: some View {
        VStack(spacing: .lg) {
            ZStack {
                Circle()
                    .fill(Color.app.accent.opacity(0.1))
                    .frame(width: 120, height: 120)

                Image(systemName: "doc.text.viewfinder")
                    .font(.system(size: 50))
                    .foregroundStyle(Color.app.accent)
            }

            VStack(spacing: .sm) {
                Text("Escanea un documento")
                    .font(.app(.title3))
                    .foregroundStyle(Color.app.textPrimary)

                Text("Escanea, sube fotos o archivos de recibos, facturas o estados de cuenta para extraer transacciones con IA.")
                    .font(.app(.subheadline))
                    .foregroundStyle(Color.app.textSecondary)
                    .multilineTextAlignment(.center)
            }

            PrimaryButton(
                "Agregar Documento",
                icon: "plus.circle.fill"
            ) {
                onAction()
            }
        }
        .padding(.vertical, .xl)
    }
}

struct ScannedImagesSection: View {
    let images: [UIImage]
    let onAddMore: () -> Void
    let onRemove: (Int) -> Void
    let onClear: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: .sm) {
            HStack {
                Text("Documentos (\(images.count))")
                    .font(.app(.headline))
                    .foregroundStyle(Color.app.textPrimary)

                Spacer()

                Button("Limpiar", role: .destructive) {
                    onClear()
                }
                .font(.caption)
            }

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: .sm) {
                    ForEach(Array(images.enumerated()), id: \.offset) { index, image in
                        ScannedImageThumbnail(image: image) {
                            onRemove(index)
                        }
                    }

                    Button {
                        onAddMore()
                    } label: {
                        VStack(spacing: .xs) {
                            Image(systemName: "plus.circle.fill")
                                .font(.title)
                            Text("Agregar")
                                .font(.caption)
                        }
                        .foregroundStyle(Color.app.accent)
                        .frame(width: 80, height: 100)
                        .background(Color.app.surfaceSecondary)
                        .cornerRadius(.md)
                    }
                }
            }
        }
    }
}

struct ScannedImageThumbnail: View {
    let image: UIImage
    let onRemove: () -> Void

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Image(uiImage: image)
                .resizable()
                .scaledToFill()
                .frame(width: 80, height: 100)
                .cornerRadius(.md)
                .clipped()

            Button {
                onRemove()
            } label: {
                Image(systemName: "xmark.circle.fill")
                    .font(.system(size: 20))
                    .foregroundStyle(.white)
                    .background(Circle().fill(Color.app.error))
            }
            .offset(x: 6, y: -6)
        }
    }
}

struct DocumentTypeSelector: View {
    @Binding var selectedType: DocumentType

    var body: some View {
        VStack(alignment: .leading, spacing: .sm) {
            Text("Tipo de documento")
                .font(.app(.subheadline))
                .foregroundStyle(Color.app.textSecondary)

            HStack(spacing: .sm) {
                ForEach(DocumentType.allCases, id: \.self) { type in
                    Button {
                        selectedType = type
                    } label: {
                        HStack(spacing: .xs) {
                            Image(systemName: type.icon)
                                .font(.system(size: 14))
                            Text(type.displayName)
                                .font(.app(.caption))
                        }
                        .padding(.horizontal, .md)
                        .padding(.vertical, .sm)
                        .background(selectedType == type ? Color.app.accent : Color.app.surfaceSecondary)
                        .foregroundStyle(selectedType == type ? .white : Color.app.textSecondary)
                        .cornerRadius(.md)
                    }
                    .buttonStyle(PlainButtonStyle())
                }
            }
        }
    }
}

struct ExtractButton: View {
    let isEnabled: Bool
    let isProcessing: Bool
    let action: () -> Void

    var body: some View {
        PrimaryButton(
            "Extraer Transacciones",
            icon: "wand.and.stars",
            isLoading: isProcessing
        ) {
            action()
        }
        .disabled(!isEnabled || isProcessing)
        .opacity(isEnabled ? 1 : 0.5)
    }
}

struct ExtractedTransactionsSection: View {
    let transactions: [ExtractedTransaction]
    let categories: [Category]
    let selectedAccountId: String
    let onSave: (ExtractedTransaction, String) -> Void

    @State private var savedIds: Set<String> = []

    var body: some View {
        VStack(alignment: .leading, spacing: .sm) {
            HStack {
                Text("Transacciones encontradas")
                    .font(.app(.headline))
                    .foregroundStyle(Color.app.textPrimary)

                Spacer()

                if !savedIds.isEmpty {
                    Text("\(savedIds.count)/\(transactions.count)")
                        .font(.caption)
                        .foregroundStyle(.white)
                        .padding(.horizontal, .sm)
                        .padding(.vertical, 2)
                        .background(Color.app.success)
                        .cornerRadius(.sm)
                }

                Text("\(transactions.count)")
                    .font(.caption)
                    .foregroundStyle(.white)
                    .padding(.horizontal, .sm)
                    .padding(.vertical, 2)
                    .background(Color.app.accent)
                    .cornerRadius(.sm)
            }

            VStack(spacing: .sm) {
                ForEach(transactions) { transaction in
                    let txId = transaction.id ?? transaction.name
                    ExtractedTransactionCard(
                        transaction: transaction,
                        categories: categories,
                        isSaved: savedIds.contains(txId),
                        onSave: { categoryId in
                            onSave(transaction, categoryId)
                            savedIds.insert(txId)
                        }
                    )
                }
            }
        }
    }
}

struct ExtractedTransactionCard: View {
    let transaction: ExtractedTransaction
    let categories: [Category]
    let isSaved: Bool
    let onSave: (String) -> Void

    @State private var selectedCategoryId = ""
    @State private var isSaving = false

    var body: some View {
        GlassCard(cornerRadius: .lg, padding: .md) {
            VStack(spacing: .sm) {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(transaction.name)
                            .font(.app(.headline))
                            .foregroundStyle(Color.app.textPrimary)

                        if let description = transaction.description {
                            Text(description)
                                .font(.caption)
                                .foregroundStyle(Color.app.textSecondary)
                                .lineLimit(1)
                        }
                    }

                    Spacer()

                    VStack(alignment: .trailing, spacing: 2) {
                        Text(transaction.amount.currencyFormatted)
                            .font(.app(.headline))
                            .foregroundStyle(transaction.typeTransaction == "income" ? Color.app.success : Color.app.error)

                        Text(transaction.typeTransaction == "income" ? "Ingreso" : "Gasto")
                            .font(.caption2)
                            .foregroundStyle(Color.app.textTertiary)
                    }
                }

                if isSaved {
                    HStack(spacing: .xs) {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundStyle(Color.app.success)
                        Text("Guardada")
                            .font(.app(.caption))
                            .foregroundStyle(Color.app.success)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, .xs)
                } else {
                    DropdownPicker(
                        title: "Categoría",
                        selection: $selectedCategoryId,
                        options: categories.map { $0.id },
                        labelForOption: { id in
                            if id.isEmpty { return "Seleccionar categoría" }
                            return categories.first(where: { $0.id == id })
                                .map { "\($0.icon) \($0.name)" } ?? id
                        }
                    )

                    Button {
                        isSaving = true
                        onSave(selectedCategoryId)
                        HapticManager.shared.notification(.success)
                    } label: {
                        HStack(spacing: .xs) {
                            if isSaving {
                                ProgressView()
                                    .tint(.white)
                            } else {
                                Image(systemName: "square.and.arrow.down")
                                Text("Guardar")
                                    .font(.app(.subheadline))
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, .sm)
                        .background(selectedCategoryId.isEmpty ? Color.app.textTertiary : Color.app.accent)
                        .foregroundStyle(.white)
                        .cornerRadius(.md)
                    }
                    .disabled(selectedCategoryId.isEmpty || isSaving)
                }
            }
        }
        .opacity(isSaved ? 0.7 : 1)
        .onAppear {
            if let aiCategoryId = transaction.categoryId, !aiCategoryId.isEmpty,
               categories.contains(where: { $0.id == aiCategoryId }) {
                selectedCategoryId = aiCategoryId
            }
        }
    }
}

struct DocumentCameraView: UIViewControllerRepresentable {
    let completion: (UIImage?) -> Void

    func makeUIViewController(context: Context) -> VNDocumentCameraViewController {
        let viewController = VNDocumentCameraViewController()
        viewController.delegate = context.coordinator
        return viewController
    }

    func updateUIViewController(_ uiViewController: VNDocumentCameraViewController, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(completion: completion)
    }

    class Coordinator: NSObject, VNDocumentCameraViewControllerDelegate {
        let completion: (UIImage?) -> Void

        init(completion: @escaping (UIImage?) -> Void) {
            self.completion = completion
        }

        func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFinishWith scan: VNDocumentCameraScan) {
            for i in 0..<scan.pageCount {
                completion(scan.imageOfPage(at: i))
            }
            controller.dismiss(animated: true)
        }

        func documentCameraViewControllerDidCancel(_ controller: VNDocumentCameraViewController) {
            completion(nil)
            controller.dismiss(animated: true)
        }

        func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFailWithError error: Error) {
            completion(nil)
            controller.dismiss(animated: true)
        }
    }
}

#Preview {
    DocumentScannerView()
}
