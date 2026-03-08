import Foundation
import Combine

@MainActor
class CategoriesViewModel: BaseViewModel {
    @Published var categories: [Category] = []

    private let categoryRepository: CategoryRepository

    init(categoryRepository: CategoryRepository? = nil) {
        self.categoryRepository = categoryRepository ?? DependencyContainer.shared.resolve(CategoryRepository.self)
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

    func updateCategory(_ id: String, request: UpdateCategoryRequest) async throws -> Category {
        let category = try await categoryRepository.update(id, request: request)
        showSuccess("Categoría actualizada")
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
}
