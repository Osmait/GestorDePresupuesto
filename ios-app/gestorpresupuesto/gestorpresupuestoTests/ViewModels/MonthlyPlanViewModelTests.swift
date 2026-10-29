import Foundation
import Testing
@testable import gestorpresupuesto

@Suite("MonthlyPlanViewModel Tests")
struct MonthlyPlanViewModelTests {

    /// 28 Oct 2026 at noon, local time.
    private static let today: Date = {
        Calendar.current.date(from: DateComponents(year: 2026, month: 10, day: 28, hour: 12))!
    }()

    @MainActor private func makeSUT(
        items: [MonthlyPlanItem] = [],
        categories: [gestorpresupuesto.Category] = []
    ) -> (MonthlyPlanViewModel, MockMonthlyPlanRepository) {
        let planRepo = MockMonthlyPlanRepository()
        planRepo.getAllResult = .success(items)
        let categoryRepo = MockCategoryRepository()
        categoryRepo.getAllResult = .success(categories)
        let vm = MonthlyPlanViewModel(
            monthlyPlanRepository: planRepo,
            categoryRepository: categoryRepo,
            now: { Self.today }
        )
        return (vm, planRepo)
    }

    // MARK: - Loading

    @Test @MainActor func load_success() async {
        let (vm, _) = makeSUT(items: [.fixture()], categories: [.fixture(id: "cat-1", name: "Vivienda")])

        await vm.load()

        #expect(vm.items.count == 1)
        #expect(vm.summary == .fixture())
        #expect(vm.categories.count == 1)
        #expect(!vm.isLoading)
    }

    @Test @MainActor func load_error() async {
        let (vm, repo) = makeSUT()
        repo.getAllResult = .failure(MockError.forced)

        await vm.load()

        #expect(vm.error != nil)
        #expect(vm.items.isEmpty)
    }

    // MARK: - Groups

    @Test @MainActor func groups_byCategory_incomeFirstThenBiggestCategory() async {
        let (vm, _) = makeSUT(
            items: [
                .fixture(id: "rent", name: "Alquiler", amount: 32000, categoryId: "home"),
                .fixture(id: "net", name: "Internet", amount: 3000, categoryId: "services"),
                .fixture(id: "pay", name: "Nómina", amount: 48000, type: .income, categoryId: nil, dayOfMonth: 15),
            ],
            categories: [.fixture(id: "home", name: "Vivienda"), .fixture(id: "services", name: "Servicios")]
        )
        await vm.load()

        let groups = vm.groups

        #expect(groups.map(\.id) == [MonthlyPlanViewModel.incomeGroupId, "home", "services"])
        #expect(groups[1].title == "Vivienda")
        #expect(groups[0].share == nil)
        #expect(abs((groups[1].share ?? 0) - 32000.0 / 35000.0) < 0.0001)
    }

    @Test @MainActor func groups_hidePausedUnlessShown() async {
        let (vm, _) = makeSUT(items: [
            .fixture(id: "a", name: "Gym", isActive: false),
            .fixture(id: "b", name: "Alquiler"),
        ])
        await vm.load()

        #expect(vm.pausedCount == 1)
        #expect(vm.groups.flatMap(\.items).map(\.id) == ["b"])

        vm.showPaused = true
        #expect(Set(vm.groups.flatMap(\.items).map(\.id)) == ["a", "b"])
    }

    @Test @MainActor func groups_pausedItemsDoNotCountInTotals() async {
        let (vm, _) = makeSUT(items: [
            .fixture(id: "a", amount: 1000, categoryId: "c"),
            .fixture(id: "b", amount: 500, categoryId: "c", isActive: false),
        ])
        await vm.load()
        vm.showPaused = true

        #expect(vm.groups.first?.total == 1000)
    }

    @Test @MainActor func groups_byDay_sortsItemsByDay() async {
        let (vm, _) = makeSUT(items: [
            .fixture(id: "late", name: "Alquiler", categoryId: "a", dayOfMonth: 30),
            .fixture(id: "none", name: "Varios", categoryId: "b", dayOfMonth: nil),
            .fixture(id: "early", name: "Internet", categoryId: "b", dayOfMonth: 5),
        ])
        await vm.load()
        vm.grouping = .day

        #expect(vm.groups.count == 1)
        #expect(vm.groups[0].items.map(\.id) == ["early", "late", "none"])
    }

    @Test @MainActor func categoryName_unknownFallsBackToUncategorized() {
        let (vm, _) = makeSUT()
        #expect(vm.categoryName(for: nil) == "Sin categoría")
        #expect(vm.categoryName(for: "missing") == "Sin categoría")
    }

    // MARK: - Due dates

    @Test @MainActor func daysUntilDue() {
        let (vm, _) = makeSUT()

        #expect(vm.daysUntilDue(.fixture(dayOfMonth: 30)) == 2)
        #expect(vm.daysUntilDue(.fixture(dayOfMonth: 28)) == 0)
        #expect(vm.daysUntilDue(.fixture(dayOfMonth: 5)) == nil)
        #expect(vm.daysUntilDue(.fixture(dayOfMonth: nil)) == nil)
    }

    @Test @MainActor func nextBill_skipsIncomePausedAndPastDays() async {
        let (vm, _) = makeSUT(items: [
            .fixture(id: "past", dayOfMonth: 5),
            .fixture(id: "paused", dayOfMonth: 29, isActive: false),
            .fixture(id: "income", type: .income, dayOfMonth: 29),
            .fixture(id: "next", dayOfMonth: 30),
        ])
        await vm.load()

        #expect(vm.nextBill?.id == "next")
    }

    @Test @MainActor func nextBill_wrapsToNextMonth() async {
        let (vm, _) = makeSUT(items: [
            .fixture(id: "second", dayOfMonth: 10),
            .fixture(id: "first", dayOfMonth: 3),
        ])
        await vm.load()

        #expect(vm.nextBill?.id == "first")
    }

    // MARK: - Actions

    @Test @MainActor func save_new_createsAndReloads() async throws {
        let (vm, repo) = makeSUT()
        let request = MonthlyPlanItemRequest(
            name: "Alquiler", description: "", amount: 32000, currency: "DOP",
            type: .bill, categoryId: nil, accountId: nil, dayOfMonth: 30, isActive: true
        )

        try await vm.save(request, editing: nil)

        #expect(repo.lastCreateRequest == request)
        #expect(repo.lastUpdate == nil)
        #expect(repo.getAllCallCount == 1)
    }

    @Test @MainActor func save_existing_updates() async throws {
        let (vm, repo) = makeSUT()
        let request = MonthlyPlanItemRequest(
            name: "Alquiler", description: "", amount: 33000, currency: "DOP",
            type: .bill, categoryId: nil, accountId: nil, dayOfMonth: 30, isActive: true
        )

        try await vm.save(request, editing: "plan-1")

        #expect(repo.lastUpdate?.id == "plan-1")
        #expect(repo.lastCreateRequest == nil)
    }

    @Test @MainActor func save_error_propagates() async {
        let (vm, repo) = makeSUT()
        repo.createError = MockError.forced
        let request = MonthlyPlanItemRequest(
            name: "X", description: "", amount: 1, currency: "DOP",
            type: .bill, categoryId: nil, accountId: nil, dayOfMonth: nil, isActive: true
        )

        await #expect(throws: MockError.self) {
            try await vm.save(request, editing: nil)
        }
    }

    @Test @MainActor func toggleActive_flipsTheFlag() async {
        let (vm, repo) = makeSUT()

        await vm.toggleActive(.fixture(id: "plan-1", isActive: true))

        #expect(repo.lastSetActive?.id == "plan-1")
        #expect(repo.lastSetActive?.isActive == false)
    }

    @Test @MainActor func delete_removesItem() async {
        let (vm, repo) = makeSUT(items: [.fixture(id: "a"), .fixture(id: "b")])
        await vm.load()

        await vm.delete(vm.items[0])

        #expect(repo.deleteCallCount == 1)
        #expect(vm.items.map(\.id) == ["b"])
    }

    @Test @MainActor func delete_error_keepsItem() async {
        let (vm, repo) = makeSUT(items: [.fixture(id: "a")])
        await vm.load()
        repo.deleteError = MockError.forced

        await vm.delete(vm.items[0])

        #expect(vm.items.count == 1)
        #expect(vm.error != nil)
    }
}
