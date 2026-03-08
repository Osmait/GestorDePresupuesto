import SwiftUI
import Combine

struct SearchView: View {
    @StateObject private var viewModel = SearchViewModel()

    var body: some View {
        NavigationStack {
            ZStack {
                Color.app.background.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: Spacing.lg.rawValue) {
                        if viewModel.query.isEmpty {
                            VStack(spacing: Spacing.md.rawValue) {
                                Image(systemName: "magnifyingglass")
                                    .font(.largeTitle)
                                    .foregroundStyle(Color.app.textTertiary)
                                Text("Busca transacciones, cuentas, categorías y más")
                                    .font(.app(.caption))
                                    .foregroundStyle(Color.app.textSecondary)
                                    .multilineTextAlignment(.center)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.top, Spacing.xxxl.rawValue)
                        } else if let results = viewModel.results {
                            if !results.transactions.isEmpty {
                                searchSection("Transacciones", icon: "arrow.left.arrow.right") {
                                    ForEach(results.transactions) { transaction in
                                        HStack {
                                            VStack(alignment: .leading) {
                                                Text(transaction.name)
                                                    .font(.app(.subheadline))
                                                    .foregroundStyle(Color.app.textPrimary)
                                                Text(transaction.createdAt.shortFormatted)
                                                    .font(.caption2)
                                                    .foregroundStyle(Color.app.textTertiary)
                                            }
                                            Spacer()
                                            Text(transaction.amount.currencyFormatted)
                                                .font(.app(.subheadline))
                                                .fontWeight(.semibold)
                                                .foregroundStyle(transaction.isIncome ? Color.app.success : Color.app.error)
                                        }
                                        .padding(.vertical, 4)
                                    }
                                }
                            }

                            if !results.accounts.isEmpty {
                                searchSection("Cuentas", icon: "creditcard.fill") {
                                    ForEach(results.accounts) { account in
                                        HStack {
                                            Text(account.name)
                                                .font(.app(.subheadline))
                                                .foregroundStyle(Color.app.textPrimary)
                                            Spacer()
                                            Text(account.bank)
                                                .font(.app(.caption))
                                                .foregroundStyle(Color.app.textSecondary)
                                        }
                                        .padding(.vertical, 4)
                                    }
                                }
                            }

                            if !results.categories.isEmpty {
                                searchSection("Categorías", icon: "tag.fill") {
                                    ForEach(results.categories) { category in
                                        HStack {
                                            Circle()
                                                .fill(category.colorValue)
                                                .frame(width: 12, height: 12)
                                            Text(category.name)
                                                .font(.app(.subheadline))
                                                .foregroundStyle(Color.app.textPrimary)
                                        }
                                        .padding(.vertical, 4)
                                    }
                                }
                            }

                            if !results.budgets.isEmpty {
                                searchSection("Presupuestos", icon: "chart.bar.fill") {
                                    ForEach(results.budgets) { budget in
                                        HStack {
                                            Text(budget.categoryName ?? "Presupuesto")
                                                .font(.app(.subheadline))
                                                .foregroundStyle(Color.app.textPrimary)
                                            Spacer()
                                            if let amount = budget.amount {
                                                Text(amount.currencyFormatted)
                                                    .font(.app(.caption))
                                                    .foregroundStyle(Color.app.textSecondary)
                                            }
                                        }
                                        .padding(.vertical, 4)
                                    }
                                }
                            }

                            if !results.loans.isEmpty {
                                searchSection("Préstamos", icon: "doc.text.fill") {
                                    ForEach(results.loans) { loan in
                                        HStack {
                                            Text(loan.borrowerName)
                                                .font(.app(.subheadline))
                                                .foregroundStyle(Color.app.textPrimary)
                                            Spacer()
                                            Text(loan.pendingAmount.currencyFormatted)
                                                .font(.app(.caption))
                                                .foregroundStyle(Color.app.textSecondary)
                                        }
                                        .padding(.vertical, 4)
                                    }
                                }
                            }

                            if results.transactions.isEmpty && results.accounts.isEmpty &&
                               results.categories.isEmpty && results.budgets.isEmpty &&
                               results.loans.isEmpty && results.certificates.isEmpty {
                                VStack(spacing: Spacing.md.rawValue) {
                                    Image(systemName: "magnifyingglass")
                                        .font(.title)
                                        .foregroundStyle(Color.app.textTertiary)
                                    Text("Sin resultados para \"\(viewModel.query)\"")
                                        .font(.app(.caption))
                                        .foregroundStyle(Color.app.textSecondary)
                                }
                                .frame(maxWidth: .infinity)
                                .padding(.top, Spacing.xxxl.rawValue)
                            }
                        }
                    }
                    .padding(Spacing.lg.rawValue)
                }
            }
            .navigationTitle("Buscar")
            .searchable(text: $viewModel.query, prompt: "Buscar...")
            .onChange(of: viewModel.query) { _, newValue in
                viewModel.debouncedSearch(newValue)
            }
        }
    }

    @ViewBuilder
    private func searchSection<Content: View>(_ title: String, icon: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: Spacing.sm.rawValue) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.caption)
                    .foregroundStyle(Color.app.accent)
                Text(title)
                    .font(.app(.subheadline))
                    .fontWeight(.semibold)
                    .foregroundStyle(Color.app.textPrimary)
            }
            .padding(.bottom, 4)

            SurfaceCard {
                VStack(alignment: .leading, spacing: 0) {
                    content()
                }
            }
        }
    }
}

@MainActor
class SearchViewModel: BaseViewModel {
    @Published var query = ""
    @Published var results: SearchResponse?

    private let searchRepository: SearchRepository
    private var searchTask: Task<Void, Never>?

    init(searchRepository: SearchRepository? = nil) {
        self.searchRepository = searchRepository ?? DependencyContainer.shared.resolve(SearchRepository.self)
    }

    func debouncedSearch(_ query: String) {
        searchTask?.cancel()

        guard !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            results = nil
            return
        }

        searchTask = Task {
            try? await Task.sleep(nanoseconds: 300_000_000)
            guard !Task.isCancelled else { return }
            await search(query)
        }
    }

    private func search(_ query: String) async {
        do {
            results = try await searchRepository.search(query: query)
        } catch {
            if !Task.isCancelled {
                showError(error.localizedDescription)
            }
        }
    }
}
