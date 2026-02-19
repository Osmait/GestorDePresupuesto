import SwiftUI
import VisionKit

struct DocumentScannerView: View {
    @StateObject private var viewModel = DocumentScannerViewModel()
    @StateObject private var accountsViewModel = AccountsViewModel()
    @StateObject private var categoriesViewModel = CategoriesViewModel()
    @State private var showDocumentCamera = false
    @State private var showTransactionConfirmation = false
    @State private var selectedTransaction: ExtractedTransaction?
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        ZStack {
            Color.app.background.ignoresSafeArea()
            
            ScrollView {
                VStack(spacing: .lg) {
                    if viewModel.scannedImages.isEmpty {
                        EmptyScannerState(onScan: { showDocumentCamera = true })
                    } else {
                        ScannedImagesSection(
                            images: viewModel.scannedImages,
                            onAddMore: { showDocumentCamera = true },
                            onRemove: { index in viewModel.removeScannedImage(at: index) },
                            onClear: { viewModel.clearScannedImages() }
                        )
                        
                        DocumentTypeSelector(selectedType: $viewModel.documentType)
                        
                        AccountSelector(
                            accounts: accountsViewModel.accounts,
                            selectedAccountId: $viewModel.selectedAccountId
                        )
                        
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
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button("Cerrar") {
                    dismiss()
                }
                .foregroundStyle(Color.app.textSecondary)
            }
        }
        .sheet(isPresented: $showDocumentCamera) {
            DocumentCameraView { image in
                if let image = image {
                    viewModel.addScannedImage(image)
                }
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
    let onScan: () -> Void
    
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
                
                Text("Toma una foto de recibos, facturas o estados de cuenta para extraer transacciones automáticamente con IA.")
                    .font(.app(.subheadline))
                    .foregroundStyle(Color.app.textSecondary)
                    .multilineTextAlignment(.center)
            }
            
            PrimaryButton(
                "Escanear Documento",
                icon: "camera.fill"
            ) {
                onScan()
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
                Text("Documentos escaneados")
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

struct AccountSelector: View {
    let accounts: [AccountResponse]
    @Binding var selectedAccountId: String
    
    var body: some View {
        VStack(alignment: .leading, spacing: .sm) {
            Text("Cuenta destino")
                .font(.app(.subheadline))
                .foregroundStyle(Color.app.textSecondary)
            
            if accounts.isEmpty {
                HStack {
                    Image(systemName: "exclamationmark.triangle")
                        .foregroundStyle(Color.app.warning)
                    Text("No hay cuentas disponibles")
                        .font(.caption)
                        .foregroundStyle(Color.app.textSecondary)
                }
            } else {
                Menu {
                    ForEach(accounts, id: \.accountInfo.id) { account in
                        Button {
                            selectedAccountId = account.accountInfo.id
                        } label: {
                            Text("\(account.accountInfo.name) - \(account.accountInfo.bank)")
                        }
                    }
                } label: {
                    HStack {
                        Image(systemName: "building.columns")
                            .foregroundStyle(selectedAccountId.isEmpty ? Color.app.textTertiary : Color.app.accent)
                        Text(selectedAccountId.isEmpty ? "Seleccionar cuenta" : accounts.first(where: { $0.accountInfo.id == selectedAccountId })?.accountInfo.name ?? "")
                            .foregroundStyle(selectedAccountId.isEmpty ? Color.app.textTertiary : Color.app.textPrimary)
                        Spacer()
                        Image(systemName: "chevron.down")
                            .foregroundStyle(Color.app.textTertiary)
                    }
                    .padding()
                    .background(Color.app.surfaceSecondary)
                    .cornerRadius(.md)
                    .overlay(
                        RoundedRectangle(cornerRadius: Radius.md.rawValue)
                            .stroke(!selectedAccountId.isEmpty ? Color.app.success : Color.app.border, lineWidth: 1)
                    )
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
    
    var body: some View {
        VStack(alignment: .leading, spacing: .sm) {
            HStack {
                Text("Transacciones encontradas")
                    .font(.app(.headline))
                    .foregroundStyle(Color.app.textPrimary)
                
                Spacer()
                
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
                    ExtractedTransactionCard(
                        transaction: transaction,
                        categories: categories,
                        onSave: { categoryId in
                            onSave(transaction, categoryId)
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
                
                HStack(spacing: .sm) {
                    Menu {
                        ForEach(categories) { category in
                            Button {
                                selectedCategoryId = category.id
                            } label: {
                                Text("\(category.icon) \(category.name)")
                            }
                        }
                    } label: {
                        HStack {
                            if selectedCategoryId.isEmpty {
                                Text("Seleccionar categoría")
                                    .font(.caption)
                            } else {
                                if let category = categories.first(where: { $0.id == selectedCategoryId }) {
                                    Text("\(category.icon) \(category.name)")
                                        .font(.caption)
                                }
                            }
                            Image(systemName: "chevron.down")
                                .font(.caption2)
                        }
                        .foregroundStyle(selectedCategoryId.isEmpty ? Color.app.textTertiary : Color.app.textPrimary)
                        .padding(.horizontal, .sm)
                        .padding(.vertical, .xs)
                        .background(Color.app.surfaceSecondary)
                        .cornerRadius(.sm)
                    }
                    
                    Spacer()
                    
                    Button {
                        isSaving = true
                        onSave(selectedCategoryId)
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                            isSaving = false
                        }
                    } label: {
                        if isSaving {
                            ProgressView()
                                .frame(width: 20, height: 20)
                        } else {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.system(size: 24))
                        }
                    }
                    .foregroundStyle(selectedCategoryId.isEmpty ? Color.app.textTertiary : Color.app.success)
                    .disabled(selectedCategoryId.isEmpty || isSaving)
                }
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
            if scan.pageCount > 0 {
                let image = scan.imageOfPage(at: 0)
                completion(image)
            } else {
                completion(nil)
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
