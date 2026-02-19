import Foundation
import UIKit
import Combine

@MainActor
class CategoriesViewModel: ObservableObject {
    @Published var categories: [Category] = []
    @Published var isLoading = false
    @Published var error: String?
    
    @Published var showErrorBanner = false
    @Published var errorBannerMessage = ""
    @Published var showToast = false
    @Published var toastType: ToastType = .success
    @Published var toastMessage = ""
    
    private let categoryRepository: CategoryRepository
    
    init(categoryRepository: CategoryRepository = CategoryRepositoryImpl()) {
        self.categoryRepository = categoryRepository
    }
    
    func loadCategories() async {
        isLoading = true
        error = nil
        
        do {
            categories = try await categoryRepository.getAll()
        } catch {
            showError(error.localizedDescription)
        }
        
        isLoading = false
    }
    
    func createCategory(request: CreateCategoryRequest) async throws -> Category {
        let category = try await categoryRepository.create(request)
        showSuccess("Categoría creada")
        await loadCategories()
        return category
    }
    
    func deleteCategory(_ id: String) async {
        do {
            try await categoryRepository.delete(id)
            categories.removeAll { $0.id == id }
            showSuccess("Categoría eliminada")
        } catch {
            showError(error.localizedDescription)
        }
    }
    
    private func showError(_ message: String) {
        error = message
        errorBannerMessage = message
        showErrorBanner = true
        
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(.error)
    }
    
    private func showSuccess(_ message: String) {
        toastType = .success
        toastMessage = message
        showToast = true
    }
}
