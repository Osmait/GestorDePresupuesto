import Testing
@testable import gestorpresupuesto

@Suite("CategoriesViewModel Tests")
struct CategoriesViewModelTests {

    @Test @MainActor func loadCategories_success() async {
        let mock = MockCategoryRepository()
        mock.getAllResult = .success([.fixture()])
        let vm = CategoriesViewModel(categoryRepository: mock)

        await vm.loadCategories()

        #expect(vm.categories.count == 1)
        #expect(!vm.isLoading)
    }

    @Test @MainActor func loadCategories_error() async {
        let mock = MockCategoryRepository()
        mock.getAllResult = .failure(MockError.forced)
        let vm = CategoriesViewModel(categoryRepository: mock)

        await vm.loadCategories()

        #expect(vm.error != nil)
    }

    @Test @MainActor func createCategory_success() async throws {
        let mock = MockCategoryRepository()
        mock.createResult = .success(.fixture())
        mock.getAllResult = .success([.fixture()])
        let vm = CategoriesViewModel(categoryRepository: mock)

        let category = try await vm.createCategory(request: CreateCategoryRequest(
            name: "Comida", icon: "fork.knife", color: "#FF5733"
        ))

        #expect(category.name == "Alimentación")
    }

    @Test @MainActor func updateCategory_success() async throws {
        let mock = MockCategoryRepository()
        mock.updateResult = .success(.fixture())
        mock.getAllResult = .success([.fixture()])
        let vm = CategoriesViewModel(categoryRepository: mock)

        _ = try await vm.updateCategory("cat-1", request: UpdateCategoryRequest(
            name: "Updated", icon: "star", color: "#000000"
        ))

        #expect(mock.getAllCallCount >= 1)
    }

    @Test @MainActor func deleteCategory_success() async {
        let mock = MockCategoryRepository()
        let vm = CategoriesViewModel(categoryRepository: mock)
        vm.categories = [.fixture(id: "cat-1")]

        await vm.deleteCategory("cat-1")

        #expect(vm.categories.isEmpty)
    }

    @Test @MainActor func deleteCategory_error() async {
        let mock = MockCategoryRepository()
        mock.deleteError = MockError.forced
        let vm = CategoriesViewModel(categoryRepository: mock)

        await vm.deleteCategory("cat-1")

        #expect(vm.error != nil)
    }

    @Test @MainActor func loadCategories_clearsError() async {
        let mock = MockCategoryRepository()
        mock.getAllResult = .success([])
        let vm = CategoriesViewModel(categoryRepository: mock)
        vm.error = "old error"

        await vm.loadCategories()

        #expect(vm.error == nil)
    }
}
