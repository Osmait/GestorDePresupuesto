import SwiftUI

struct TransactionFilterView: View {
    @ObservedObject var viewModel: TransactionsViewModel
    @Binding var isPresented: Bool

    @State private var localPeriod: FilterPeriod = .thisMonth
    @State private var localType: FilterType = .all
    @State private var localCategoryId: String?
    @State private var localAccountId: String?
    @State private var localSearch: String = ""
    @State private var localAmountMin: String = ""
    @State private var localAmountMax: String = ""

    private var activeFilterCount: Int {
        var count = 0
        if localPeriod != .thisMonth { count += 1 }
        if localType != .all { count += 1 }
        if localCategoryId != nil { count += 1 }
        if localAccountId != nil { count += 1 }
        if !localSearch.isEmpty { count += 1 }
        if !localAmountMin.isEmpty || !localAmountMax.isEmpty { count += 1 }
        return count
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.app.background.ignoresSafeArea()

                VStack(spacing: 0) {
                    ScrollView {
                        VStack(spacing: Spacing.xl.rawValue) {
                            // Search
                            searchSection

                            // Period
                            periodSection

                            // Type
                            typeSection

                            // Category
                            categorySection

                            // Account
                            accountSection

                            // Amount range
                            amountSection
                        }
                        .padding(Spacing.lg.rawValue)
                        .padding(.bottom, 80)
                    }

                    // Sticky bottom buttons
                    bottomBar
                }
            }
            .navigationTitle("Filtros")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { isPresented = false }
                }
                ToolbarItem(placement: .primaryAction) {
                    if activeFilterCount > 0 {
                        Button("Limpiar") { clearFilters() }
                            .font(.subheadline)
                            .foregroundStyle(Color.app.error)
                    }
                }
            }
            .onAppear { loadCurrentFilters() }
        }
    }

    // MARK: - Search

    private var searchSection: some View {
        HStack(spacing: Spacing.sm.rawValue) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(Color.app.textTertiary)
            TextField("Buscar transacciones...", text: $localSearch)
                .font(.app(.subheadline))
        }
        .padding(Spacing.md.rawValue)
        .background(Color.app.surfaceSecondary)
        .clipShape(RoundedRectangle(cornerRadius: Radius.lg.rawValue))
    }

    // MARK: - Period

    private var periodSection: some View {
        filterSection("Período") {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Spacing.sm.rawValue) {
                    ForEach(FilterPeriod.allCases, id: \.self) { option in
                        chipButton(
                            title: option.rawValue,
                            isSelected: localPeriod == option
                        ) {
                            localPeriod = option
                        }
                    }
                }
            }
        }
    }

    // MARK: - Type

    private var typeSection: some View {
        filterSection("Tipo") {
            HStack(spacing: Spacing.sm.rawValue) {
                ForEach(FilterType.allCases, id: \.self) { option in
                    typeChip(option)
                }
            }
        }
    }

    private func typeChip(_ option: FilterType) -> some View {
        let isSelected = localType == option
        let color: Color = {
            switch option {
            case .all: return .app.accent
            case .income: return .app.success
            case .expense: return .app.error
            }
        }()
        let icon: String = {
            switch option {
            case .all: return "arrow.left.arrow.right"
            case .income: return "arrow.up.circle.fill"
            case .expense: return "arrow.down.circle.fill"
            }
        }()

        return Button {
            localType = option
        } label: {
            HStack(spacing: Spacing.xs.rawValue) {
                Image(systemName: icon)
                    .font(.caption)
                Text(option.rawValue)
                    .font(.app(.caption))
                    .fontWeight(.medium)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, Spacing.sm.rawValue)
            .foregroundStyle(isSelected ? .white : Color.app.textSecondary)
            .background(isSelected ? color : Color.app.surfaceSecondary)
            .clipShape(RoundedRectangle(cornerRadius: Radius.lg.rawValue))
        }
        .buttonStyle(.plain)
    }

    // MARK: - Category

    private var categorySection: some View {
        filterSection("Categoría", clearAction: localCategoryId != nil ? { localCategoryId = nil } : nil) {
            if viewModel.categories.isEmpty {
                emptyLabel("No hay categorías")
            } else {
                let columns = [GridItem(.adaptive(minimum: 120), spacing: Spacing.sm.rawValue)]
                LazyVGrid(columns: columns, spacing: Spacing.sm.rawValue) {
                    ForEach(viewModel.categories) { category in
                        let isSelected = localCategoryId == category.id
                        Button {
                            localCategoryId = isSelected ? nil : category.id
                        } label: {
                            HStack(spacing: Spacing.xs.rawValue) {
                                Text(category.icon)
                                    .font(.system(size: 14))
                                Text(category.name)
                                    .font(.caption)
                                    .fontWeight(.medium)
                                    .lineLimit(1)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, Spacing.sm.rawValue)
                            .padding(.vertical, Spacing.sm.rawValue)
                            .foregroundStyle(isSelected ? .white : Color.app.textPrimary)
                            .background(isSelected ? category.colorValue : Color.app.surfaceSecondary)
                            .clipShape(RoundedRectangle(cornerRadius: Radius.md.rawValue))
                            .overlay(
                                RoundedRectangle(cornerRadius: Radius.md.rawValue)
                                    .stroke(isSelected ? Color.clear : Color.app.border.opacity(0.3), lineWidth: 0.5)
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    // MARK: - Account

    private var accountSection: some View {
        filterSection("Cuenta", clearAction: localAccountId != nil ? { localAccountId = nil } : nil) {
            if viewModel.accounts.isEmpty {
                emptyLabel("No hay cuentas")
            } else {
                VStack(spacing: Spacing.xs.rawValue) {
                    ForEach(viewModel.accounts, id: \.accountInfo.id) { account in
                        let isSelected = localAccountId == account.accountInfo.id
                        Button {
                            localAccountId = isSelected ? nil : account.accountInfo.id
                        } label: {
                            HStack(spacing: Spacing.md.rawValue) {
                                ZStack {
                                    Circle()
                                        .fill(isSelected ? Color.app.accent : Color.app.surfaceSecondary)
                                        .frame(width: 36, height: 36)
                                    Image(systemName: "building.columns")
                                        .font(.system(size: 14))
                                        .foregroundStyle(isSelected ? .white : Color.app.textSecondary)
                                }

                                VStack(alignment: .leading, spacing: 1) {
                                    Text(account.accountInfo.name)
                                        .font(.app(.subheadline))
                                        .fontWeight(.medium)
                                        .foregroundStyle(Color.app.textPrimary)
                                    Text(account.accountInfo.bank)
                                        .font(.caption2)
                                        .foregroundStyle(Color.app.textTertiary)
                                }

                                Spacer()

                                if isSelected {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundStyle(Color.app.accent)
                                        .font(.system(size: 20))
                                }
                            }
                            .padding(.horizontal, Spacing.md.rawValue)
                            .padding(.vertical, Spacing.sm.rawValue)
                            .background(
                                RoundedRectangle(cornerRadius: Radius.md.rawValue)
                                    .fill(isSelected ? Color.app.accent.opacity(0.08) : Color.clear)
                            )
                            .overlay(
                                RoundedRectangle(cornerRadius: Radius.md.rawValue)
                                    .stroke(isSelected ? Color.app.accent.opacity(0.4) : Color.app.border.opacity(0.2), lineWidth: 1)
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    // MARK: - Amount

    private var amountSection: some View {
        filterSection("Rango de Monto") {
            HStack(spacing: Spacing.md.rawValue) {
                amountField("Mínimo", text: $localAmountMin, placeholder: "0")
                Text("–")
                    .foregroundStyle(Color.app.textTertiary)
                    .font(.title3)
                amountField("Máximo", text: $localAmountMax, placeholder: "∞")
            }
        }
    }

    private func amountField(_ label: String, text: Binding<String>, placeholder: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.caption2)
                .foregroundStyle(Color.app.textTertiary)
            HStack(spacing: 4) {
                Text("$")
                    .font(.app(.caption))
                    .foregroundStyle(Color.app.textTertiary)
                TextField(placeholder, text: text)
                    .keyboardType(.decimalPad)
                    .font(.app(.subheadline))
            }
            .padding(.horizontal, Spacing.sm.rawValue)
            .padding(.vertical, Spacing.sm.rawValue)
            .background(Color.app.surfaceSecondary)
            .clipShape(RoundedRectangle(cornerRadius: Radius.md.rawValue))
        }
    }

    // MARK: - Bottom Bar

    private var bottomBar: some View {
        VStack(spacing: 0) {
            Divider().overlay(Color.app.border.opacity(0.3))
            HStack(spacing: Spacing.md.rawValue) {
                if activeFilterCount > 0 {
                    Text("\(activeFilterCount) filtro\(activeFilterCount == 1 ? "" : "s")")
                        .font(.app(.caption))
                        .foregroundStyle(Color.app.textSecondary)
                }
                Spacer()
                PrimaryButton("Aplicar", icon: "line.3.horizontal.decrease") {
                    applyFilters()
                }
                .frame(maxWidth: 180)
            }
            .padding(.horizontal, Spacing.lg.rawValue)
            .padding(.vertical, Spacing.md.rawValue)
            .background(Color.app.surface)
        }
    }

    // MARK: - Helpers

    @ViewBuilder
    private func filterSection<Content: View>(
        _ title: String,
        clearAction: (() -> Void)? = nil,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: Spacing.sm.rawValue) {
            HStack {
                Text(title)
                    .font(.app(.subheadline))
                    .fontWeight(.semibold)
                    .foregroundStyle(Color.app.textPrimary)
                Spacer()
                if let clearAction {
                    Button("Limpiar") { clearAction() }
                        .font(.caption)
                        .foregroundStyle(Color.app.accent)
                }
            }
            content()
        }
    }

    private func chipButton(title: String, isSelected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.app(.caption))
                .fontWeight(isSelected ? .semibold : .regular)
                .foregroundStyle(isSelected ? .white : Color.app.textPrimary)
                .padding(.horizontal, Spacing.md.rawValue)
                .padding(.vertical, Spacing.sm.rawValue)
                .background(
                    isSelected
                        ? AnyShapeStyle(LinearGradient(colors: Color.app.gradientPrimary, startPoint: .leading, endPoint: .trailing))
                        : AnyShapeStyle(Color.app.surfaceSecondary)
                )
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }

    private func emptyLabel(_ text: String) -> some View {
        Text(text)
            .font(.caption)
            .foregroundStyle(Color.app.textTertiary)
            .frame(maxWidth: .infinity, alignment: .center)
            .padding(.vertical, Spacing.sm.rawValue)
    }

    // MARK: - Actions

    private func loadCurrentFilters() {
        localPeriod = viewModel.selectedPeriod
        localType = viewModel.selectedType
        localCategoryId = viewModel.selectedCategoryId
        localAccountId = viewModel.selectedAccountId
        localSearch = viewModel.searchText
        localAmountMin = viewModel.amountMin
        localAmountMax = viewModel.amountMax
    }

    private func clearFilters() {
        localPeriod = .thisMonth
        localType = .all
        localCategoryId = nil
        localAccountId = nil
        localSearch = ""
        localAmountMin = ""
        localAmountMax = ""
    }

    private func applyFilters() {
        viewModel.selectedPeriod = localPeriod
        viewModel.selectedType = localType
        viewModel.selectedCategoryId = localCategoryId
        viewModel.selectedAccountId = localAccountId
        viewModel.searchText = localSearch
        viewModel.amountMin = localAmountMin
        viewModel.amountMax = localAmountMax

        Task {
            await viewModel.applyFilters()
            isPresented = false
        }
    }
}

#Preview {
    TransactionFilterView(
        viewModel: TransactionsViewModel(),
        isPresented: .constant(true)
    )
}
