import Foundation
import Combine

/// One section of the plan ledger: expected income, or the fixed expenses of
/// one category. `total` is in DOP.
struct MonthlyPlanGroup: Identifiable, Equatable {
    let id: String
    let title: String
    let items: [MonthlyPlanItem]
    let total: Double
    /// Share of the active fixed expenses, 0–1. `nil` for the income group.
    let share: Double?
}

@MainActor
class MonthlyPlanViewModel: BaseViewModel {
    enum Grouping: String, CaseIterable, Identifiable {
        case category
        case day

        var id: String { rawValue }

        var title: String {
            switch self {
            case .category: "Categoría"
            case .day: "Día"
            }
        }
    }

    @Published var items: [MonthlyPlanItem] = []
    @Published var summary: MonthlyPlanSummary?
    @Published var categories: [Category] = []
    @Published var grouping: Grouping = .category
    @Published var showPaused = false

    static let incomeGroupId = "income"
    static let uncategorizedGroupId = "uncategorized"

    private let monthlyPlanRepository: MonthlyPlanRepository
    private let categoryRepository: CategoryRepository
    private let now: () -> Date

    init(
        monthlyPlanRepository: MonthlyPlanRepository? = nil,
        categoryRepository: CategoryRepository? = nil,
        now: @escaping () -> Date = Date.init
    ) {
        let container = DependencyContainer.shared
        self.monthlyPlanRepository = monthlyPlanRepository ?? container.resolve(MonthlyPlanRepository.self)
        self.categoryRepository = categoryRepository ?? container.resolve(CategoryRepository.self)
        self.now = now
    }

    // MARK: - Loading

    func load() async {
        isLoading = true
        defer { isLoading = false }
        error = nil

        async let itemsTask = monthlyPlanRepository.getAll()
        async let summaryTask = monthlyPlanRepository.getSummary()
        do {
            items = try await itemsTask
            summary = try await summaryTask
        } catch {
            showError(error.localizedDescription)
            return
        }

        // Category names only label the groups; the plan still works without them.
        categories = (try? await categoryRepository.getAll()) ?? categories
    }

    // MARK: - Derived

    var pausedCount: Int {
        items.filter { !$0.isActive }.count
    }

    private var visibleItems: [MonthlyPlanItem] {
        showPaused ? items : items.filter(\.isActive)
    }

    var groups: [MonthlyPlanGroup] {
        let visible = visibleItems.sorted(by: Self.byDayThenName)
        let income = visible.filter(\.isIncome)
        let bills = visible.filter { !$0.isIncome }
        let activeBillsTotal = items.filter { !$0.isIncome && $0.isActive }.reduce(0) { $0 + $1.amountDop }

        var result: [MonthlyPlanGroup] = []
        if !income.isEmpty {
            result.append(MonthlyPlanGroup(
                id: Self.incomeGroupId,
                title: "Ingresos esperados",
                items: income,
                total: Self.activeTotal(income),
                share: nil
            ))
        }

        switch grouping {
        case .day:
            if !bills.isEmpty {
                let total = Self.activeTotal(bills)
                result.append(MonthlyPlanGroup(
                    id: "bills",
                    title: "Gastos fijos",
                    items: bills,
                    total: total,
                    share: activeBillsTotal > 0 ? total / activeBillsTotal : nil
                ))
            }
        case .category:
            let byCategory = Dictionary(grouping: bills) { $0.categoryId ?? Self.uncategorizedGroupId }
            let billGroups: [MonthlyPlanGroup] = byCategory.map { (key: String, groupItems: [MonthlyPlanItem]) in
                let total = Self.activeTotal(groupItems)
                let share: Double? = activeBillsTotal > 0 ? total / activeBillsTotal : nil
                return MonthlyPlanGroup(
                    id: key,
                    title: categoryName(for: key),
                    items: groupItems,
                    total: total,
                    share: share
                )
            }
            result.append(contentsOf: billGroups.sorted(by: Self.byTotalThenTitle))
        }
        return result
    }

    /// The next active fixed expense from today on (wrapping to next month).
    var nextBill: MonthlyPlanItem? {
        items.nextBill(from: now())
    }

    /// Days until the item's day of month (0 = today), or `nil` when it has no
    /// day or it already passed this month.
    func daysUntilDue(_ item: MonthlyPlanItem) -> Int? {
        guard let day = item.dayOfMonth else { return nil }
        let calendar = Calendar.current
        let today = calendar.component(.day, from: now())
        let daysInMonth = calendar.range(of: .day, in: .month, for: now())?.count ?? 31
        // A day 31 item falls on the last day of shorter months.
        let effectiveDay = min(day, daysInMonth)
        guard effectiveDay >= today else { return nil }
        return effectiveDay - today
    }

    func categoryName(for categoryId: String?) -> String {
        guard let categoryId, categoryId != Self.uncategorizedGroupId else { return "Sin categoría" }
        return categories.first { $0.id == categoryId }?.name ?? "Sin categoría"
    }

    // MARK: - Actions

    func save(_ request: MonthlyPlanItemRequest, editing itemId: String?) async throws {
        if let itemId {
            try await monthlyPlanRepository.update(itemId, request: request)
            showSuccess("Ítem actualizado")
        } else {
            try await monthlyPlanRepository.create(request)
            showSuccess("Ítem agregado al plan")
        }
        await load()
    }

    func toggleActive(_ item: MonthlyPlanItem) async {
        do {
            try await monthlyPlanRepository.setActive(item.id, isActive: !item.isActive)
            showSuccess(item.isActive ? "Ítem pausado" : "Ítem reactivado")
            await load()
        } catch {
            showError(error.localizedDescription)
        }
    }

    func delete(_ item: MonthlyPlanItem) async {
        do {
            try await monthlyPlanRepository.delete(item.id)
            items.removeAll { $0.id == item.id }
            showSuccess("Ítem eliminado")
            summary = try? await monthlyPlanRepository.getSummary()
        } catch {
            showError(error.localizedDescription)
        }
    }

    // MARK: - Helpers

    private static func activeTotal(_ items: [MonthlyPlanItem]) -> Double {
        items.filter(\.isActive).reduce(0) { $0 + $1.amountDop }
    }

    /// Biggest groups first; ties by title.
    private static func byTotalThenTitle(_ lhs: MonthlyPlanGroup, _ rhs: MonthlyPlanGroup) -> Bool {
        if lhs.total != rhs.total { return lhs.total > rhs.total }
        return lhs.title < rhs.title
    }

    /// Items with a day first, by day; then the rest, by name.
    private static func byDayThenName(_ lhs: MonthlyPlanItem, _ rhs: MonthlyPlanItem) -> Bool {
        switch (lhs.dayOfMonth, rhs.dayOfMonth) {
        case let (l?, r?) where l != r: return l < r
        case (.some, nil): return true
        case (nil, .some): return false
        default: return lhs.name.localizedCompare(rhs.name) == .orderedAscending
        }
    }
}
