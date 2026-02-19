import SwiftUI

struct BudgetsListView: View {
    @StateObject private var viewModel = BudgetsViewModel()
    @State private var showingAddBudget = false
    
    var body: some View {
        NavigationStack {
            ZStack {
            Color.app.background.ignoresSafeArea()
            
            Group {
                if viewModel.budgets.isEmpty && viewModel.isLoading {
                    VStack(spacing: .md) {
                        ForEach(0..<3, id: \.self) { _ in CardSkeleton() }
                    }
                    .padding()
                } else if viewModel.budgets.isEmpty {
                    EmptyStateView(
                        icon: "chart.pie",
                        title: "Sin presupuestos",
                        message: "Crea tu primer presupuesto para controlar tus gastos por categoría.",
                        actionTitle: "Crear presupuesto",
                        action: { showingAddBudget = true }
                    )
                } else {
                    List {
                        ForEach(viewModel.budgets) { budget in
                            BudgetRowView(budget: budget)
                                .listRowBackground(Color.clear)
                                .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16))
                                .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                                    Button(role: .destructive) {
                                        Task { await viewModel.deleteBudget(budget.id) }
                                    } label: {
                                        Label("Eliminar", systemImage: "trash")
                                    }
                                }
                        }
                    }
                    .listStyle(.plain)
                    .scrollContentBackground(.hidden)
                    .refreshable {
                        await viewModel.loadBudgets()
                    }
                }
            }
        }
        .navigationTitle("Presupuestos")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                IconButton("plus") {
                    showingAddBudget = true
                }
            }
        }
        .sheet(isPresented: $showingAddBudget) {
            AddBudgetView(viewModel: viewModel, isPresented: $showingAddBudget)
        }
        .task {
            if viewModel.budgets.isEmpty {
                await viewModel.loadBudgets()
            }
        }
        .errorBanner(isPresented: $viewModel.showErrorBanner, message: viewModel.errorBannerMessage)
        .toast(isPresented: $viewModel.showToast, type: viewModel.toastType, message: viewModel.toastMessage)
        }
    }
}

struct BudgetRowView: View {
    let budget: BudgetResponse
    
    var body: some View {
        GlassCard(cornerRadius: .lg, padding: .lg) {
            VStack(spacing: .md) {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Presupuesto")
                            .font(.caption)
                            .foregroundStyle(Color.app.textSecondary)
                        
                        Text(budget.amount.currencyFormatted)
                            .font(.app(.title3))
                            .fontWeight(.bold)
                            .foregroundStyle(Color.app.textPrimary)
                    }
                    
                    Spacer()
                    
                    VStack(alignment: .trailing, spacing: 2) {
                        Text("Gastado")
                            .font(.caption)
                            .foregroundStyle(Color.app.textSecondary)
                        
                        Text(budget.spent.currencyFormatted)
                            .font(.app(.headline))
                            .foregroundStyle(budget.isOverBudget ? Color.app.error : Color.app.textPrimary)
                    }
                }
                
                GradientProgressBar(
                    progress: budget.progress,
                    height: 10,
                    showLabel: false,
                    isCritical: budget.isCritical,
                    isWarning: budget.isWarning
                )
                
                HStack {
                    Text("\(budget.percentageUsed)% usado")
                        .font(.caption)
                        .foregroundStyle(Color.app.textTertiary)
                    
                    Spacer()
                    
                    if budget.isOverBudget {
                        Text("Excedido por \(abs(budget.remaining).currencyFormatted)")
                            .font(.caption)
                            .foregroundStyle(Color.app.error)
                    } else {
                        Text("Disponible: \(budget.remaining.currencyFormatted)")
                            .font(.caption)
                            .foregroundStyle(Color.app.textTertiary)
                    }
                }
            }
        }
    }
}

struct AddBudgetView: View {
    @ObservedObject var viewModel: BudgetsViewModel
    @Binding var isPresented: Bool
    
    @State private var amount = ""
    @State private var selectedCategoryId = ""
    @State private var isLoading = false
    @State private var shakeOffset: CGFloat = 0
    
    @StateObject private var categoriesViewModel = CategoriesViewModel()
    
    private var isValid: Bool {
        Double(amount) != nil && Double(amount)! > 0 && !selectedCategoryId.isEmpty
    }
    
    var body: some View {
        NavigationStack {
            ZStack {
                Color.app.background.ignoresSafeArea()
                
                GlassCard(cornerRadius: .xl, padding: .lg) {
                    VStack(spacing: .md) {
                        Text("Nuevo Presupuesto")
                            .font(.app(.title3))
                            .foregroundStyle(Color.app.textPrimary)
                        
                        VStack(spacing: .sm) {
                            FormField(
                                icon: "dollarsign",
                                placeholder: "Monto del presupuesto",
                                text: $amount,
                                keyboardType: .decimalPad,
                                validation: { value in
                                    if value.isEmpty { return "El monto es requerido" }
                                    if let doubleValue = Double(value), doubleValue <= 0 {
                                        return "El monto debe ser mayor a 0"
                                    }
                                    if Double(value) == nil { return "Ingresa un número válido" }
                                    return nil
                                }
                            )
                            
                            if categoriesViewModel.categories.isEmpty && !categoriesViewModel.isLoading {
                                HStack {
                                    Image(systemName: "exclamationmark.triangle")
                                        .foregroundStyle(Color.app.warning)
                                    Text("No hay categorías disponibles")
                                        .font(.caption)
                                        .foregroundStyle(Color.app.textSecondary)
                                }
                            } else {
                                Menu {
                                    ForEach(categoriesViewModel.categories) { category in
                                        Button {
                                            selectedCategoryId = category.id
                                        } label: {
                                            Text("\(category.icon) \(category.name)")
                                        }
                                    }
                                } label: {
                                    HStack {
                                        Image(systemName: "folder")
                                            .foregroundStyle(selectedCategoryId.isEmpty ? Color.app.textTertiary : Color.app.accent)
                                        Text(selectedCategoryId.isEmpty ? "Seleccionar categoría" : categoriesViewModel.categories.first(where: { $0.id == selectedCategoryId })?.name ?? "")
                                            .foregroundStyle(selectedCategoryId.isEmpty ? Color.app.textTertiary : Color.app.textPrimary)
                                        Spacer()
                                        Image(systemName: "chevron.down")
                                            .foregroundStyle(Color.app.textTertiary)
                                    }
                                    .padding()
                                    .background(Color.app.surfaceSecondary)
                                    .cornerRadius(.md)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: Radius.md.rawValue)
                                            .stroke(!selectedCategoryId.isEmpty ? Color.app.success : Color.app.border, lineWidth: 1)
                                    )
                                }
                            }
                        }
                        
                        HStack(spacing: .md) {
                            SecondaryButton("Cancelar") {
                                isPresented = false
                            }
                            
                            PrimaryButton(
                                "Guardar",
                                isLoading: isLoading
                            ) {
                                Task { await saveBudget() }
                            }
                            .disabled(!isValid)
                        }
                    }
                }
                .padding()
                .offset(x: shakeOffset)
                .task {
                    await categoriesViewModel.loadCategories()
                }
            }
            .navigationBarTitleDisplayMode(.inline)
        }
    }
    
    private func saveBudget() async {
        guard let amountValue = Double(amount) else { return }
        
        isLoading = true
        
        let request = CreateBudgetRequest(
            categoryId: selectedCategoryId,
            amount: amountValue
        )
        
        do {
            _ = try await viewModel.createBudget(request: request)
            isPresented = false
        } catch {
            withAnimation(.default) {
                shakeOffset = -10
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                withAnimation(.default) {
                    shakeOffset = 10
                }
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                withAnimation(.default) {
                    shakeOffset = -5
                }
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                withAnimation(.default) {
                    shakeOffset = 0
                }
            }
        }
        
        isLoading = false
    }
}

#Preview {
    BudgetsListView()
}
