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
    
    var body: some View {
        NavigationStack {
            ZStack {
                Color.app.background.ignoresSafeArea()
                
                ScrollView {
                    VStack(spacing: .lg) {
                        PeriodFilterSection(period: $localPeriod)
                        
                        TypeFilterSection(type: $localType)
                        
                        CategoryFilterSection(
                            categories: viewModel.categories,
                            selectedId: $localCategoryId
                        )
                        
                        AccountFilterSection(
                            accounts: viewModel.accounts,
                            selectedId: $localAccountId
                        )
                        
                        AmountFilterSection(
                            minAmount: $localAmountMin,
                            maxAmount: $localAmountMax
                        )
                        
                        ActionButtons(
                            hasChanges: hasChanges,
                            onClear: clearFilters,
                            onApply: applyFilters
                        )
                    }
                    .padding()
                }
            }
            .navigationTitle("Filtros")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") {
                        isPresented = false
                    }
                }
            }
            .onAppear {
                loadCurrentFilters()
            }
        }
    }
    
    private var hasChanges: Bool {
        localPeriod != viewModel.selectedPeriod ||
        localType != viewModel.selectedType ||
        localCategoryId != viewModel.selectedCategoryId ||
        localAccountId != viewModel.selectedAccountId ||
        localSearch != viewModel.searchText ||
        localAmountMin != viewModel.amountMin ||
        localAmountMax != viewModel.amountMax
    }
    
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

struct PeriodFilterSection: View {
    @Binding var period: FilterPeriod
    
    var body: some View {
        VStack(alignment: .leading, spacing: .sm) {
            Text("Período")
                .font(.app(.subheadline))
                .fontWeight(.medium)
                .foregroundStyle(Color.app.textSecondary)
            
            HStack(spacing: .sm) {
                ForEach(FilterPeriod.allCases, id: \.self) { periodOption in
                    PeriodChip(
                        title: periodOption.rawValue,
                        isSelected: period == periodOption
                    ) {
                        period = periodOption
                    }
                }
            }
        }
    }
}

struct PeriodChip: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.app(.caption))
                .fontWeight(isSelected ? .semibold : .regular)
                .foregroundStyle(isSelected ? .white : Color.app.textPrimary)
                .padding(.horizontal, .md)
                .padding(.vertical, .sm)
                .background(
                    isSelected
                        ? LinearGradient(colors: Color.app.gradientPrimary, startPoint: .leading, endPoint: .trailing)
                        : nil
                )
                .background(Color.app.surfaceSecondary)
                .cornerRadius(.full)
        }
        .buttonStyle(PlainButtonStyle())
    }
}

struct TypeFilterSection: View {
    @Binding var type: FilterType
    
    var body: some View {
        VStack(alignment: .leading, spacing: .sm) {
            Text("Tipo")
                .font(.app(.subheadline))
                .fontWeight(.medium)
                .foregroundStyle(Color.app.textSecondary)
            
            Picker("Tipo", selection: $type) {
                ForEach(FilterType.allCases, id: \.self) { typeOption in
                    Text(typeOption.rawValue).tag(typeOption)
                }
            }
            .pickerStyle(.segmented)
        }
    }
}

struct CategoryFilterSection: View {
    let categories: [Category]
    @Binding var selectedId: String?
    
    var body: some View {
        VStack(alignment: .leading, spacing: .sm) {
            HStack {
                Text("Categoría")
                    .font(.app(.subheadline))
                    .fontWeight(.medium)
                    .foregroundStyle(Color.app.textSecondary)
                
                Spacer()
                
                if selectedId != nil {
                    Button("Limpiar") {
                        selectedId = nil
                    }
                    .font(.caption)
                    .foregroundStyle(Color.app.accent)
                }
            }
            
            if categories.isEmpty {
                Text("No hay categorías disponibles")
                    .font(.caption)
                    .foregroundStyle(Color.app.textTertiary)
            } else {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 100))], spacing: .sm) {
                    ForEach(categories) { category in
                        CategoryFilterChip(
                            category: category,
                            isSelected: selectedId == category.id
                        ) {
                            selectedId = selectedId == category.id ? nil : category.id
                        }
                    }
                }
            }
        }
    }
}

struct CategoryFilterChip: View {
    let category: Category
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            HStack(spacing: .xs) {
                Text(category.icon)
                    .font(.caption)
                
                Text(category.name)
                    .font(.caption)
                    .lineLimit(1)
            }
            .padding(.horizontal, .sm)
            .padding(.vertical, .xs)
            .background(
                RoundedRectangle(cornerRadius: Radius.md.rawValue)
                    .fill(isSelected ? category.colorValue : Color.app.surfaceSecondary)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md.rawValue)
                    .stroke(isSelected ? Color.clear : Color.app.border, lineWidth: 0.5)
            )
            .foregroundStyle(isSelected ? .white : Color.app.textPrimary)
        }
        .buttonStyle(PlainButtonStyle())
    }
}

struct AccountFilterSection: View {
    let accounts: [AccountResponse]
    @Binding var selectedId: String?
    
    var body: some View {
        VStack(alignment: .leading, spacing: .sm) {
            HStack {
                Text("Cuenta")
                    .font(.app(.subheadline))
                    .fontWeight(.medium)
                    .foregroundStyle(Color.app.textSecondary)
                
                Spacer()
                
                if selectedId != nil {
                    Button("Limpiar") {
                        selectedId = nil
                    }
                    .font(.caption)
                    .foregroundStyle(Color.app.accent)
                }
            }
            
            if accounts.isEmpty {
                Text("No hay cuentas disponibles")
                    .font(.caption)
                    .foregroundStyle(Color.app.textTertiary)
            } else {
                VStack(spacing: .xs) {
                    ForEach(accounts, id: \.accountInfo.id) { account in
                        AccountFilterRow(
                            account: account,
                            isSelected: selectedId == account.accountInfo.id
                        ) {
                            selectedId = selectedId == account.accountInfo.id ? nil : account.accountInfo.id
                        }
                    }
                }
            }
        }
    }
}

struct AccountFilterRow: View {
    let account: AccountResponse
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            HStack(spacing: .md) {
                Image(systemName: "building.columns")
                    .font(.subheadline)
                    .foregroundStyle(isSelected ? .white : Color.app.textSecondary)
                    .frame(width: 32, height: 32)
                    .background(isSelected ? Color.app.accent : Color.app.surfaceSecondary)
                    .cornerRadius(Radius.sm)
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(account.accountInfo.name)
                        .font(.subheadline)
                        .fontWeight(.medium)
                    
                    Text(account.accountInfo.bank)
                        .font(.caption)
                        .foregroundStyle(Color.app.textTertiary)
                }
                
                Spacer()
                
                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(Color.app.accent)
                }
            }
            .padding(Spacing.sm)
            .background(
                RoundedRectangle(cornerRadius: Radius.md.rawValue)
                    .fill(isSelected ? Color.app.accent.opacity(0.1) : Color.clear)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md.rawValue)
                    .stroke(isSelected ? Color.app.accent : Color.app.border, lineWidth: isSelected ? 1 : 0.5)
            )
        }
        .buttonStyle(PlainButtonStyle())
    }
}

struct AmountFilterSection: View {
    @Binding var minAmount: String
    @Binding var maxAmount: String
    
    var body: some View {
        VStack(alignment: .leading, spacing: .sm) {
            Text("Rango de Monto")
                .font(.app(.subheadline))
                .fontWeight(.medium)
                .foregroundStyle(Color.app.textSecondary)
            
            HStack(spacing: .md) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Mínimo")
                        .font(.caption2)
                        .foregroundStyle(Color.app.textTertiary)
                    
                    TextField("0", text: $minAmount)
                        .keyboardType(.decimalPad)
                        .padding(Spacing.sm)
                        .background(Color.app.surfaceSecondary)
                        .cornerRadius(Radius.sm)
                }
                
                Text("-")
                    .foregroundStyle(Color.app.textTertiary)
                
                VStack(alignment: .leading, spacing: 2) {
                    Text("Máximo")
                        .font(.caption2)
                        .foregroundStyle(Color.app.textTertiary)
                    
                    TextField("∞", text: $maxAmount)
                        .keyboardType(.decimalPad)
                        .padding(Spacing.sm)
                        .background(Color.app.surfaceSecondary)
                        .cornerRadius(Radius.sm)
                }
            }
        }
    }
}

struct ActionButtons: View {
    let hasChanges: Bool
    let onClear: () -> Void
    let onApply: () -> Void
    
    var body: some View {
        HStack(spacing: .md) {
            SecondaryButton("Limpiar Todo") {
                onClear()
            }
            
            PrimaryButton("Aplicar Filtros") {
                onApply()
            }
            .disabled(!hasChanges)
        }
    }
}

#Preview {
    TransactionFilterView(
        viewModel: TransactionsViewModel(),
        isPresented: .constant(true)
    )
}
