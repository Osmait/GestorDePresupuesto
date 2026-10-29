import SwiftUI

/// Tab root (MainTabView wraps it in a NavigationStack): fixed expenses and
/// expected income of every month, with the plan totals on top.
struct MonthlyPlanView: View {
    @StateObject private var viewModel = MonthlyPlanViewModel()
    @State private var editorItem: MonthlyPlanEditorTarget?
    @State private var itemToDelete: MonthlyPlanItem?
    @State private var showDeleteConfirmation = false

    var body: some View {
        ZStack {
            Color.app.background.ignoresSafeArea()

            if viewModel.items.isEmpty && viewModel.isLoading {
                VStack(spacing: .md) {
                    ForEach(0..<3, id: \.self) { _ in CardSkeleton() }
                }
                .padding()
                .frame(maxHeight: .infinity, alignment: .top)
            } else if viewModel.items.isEmpty, let error = viewModel.error {
                EmptyStateView(
                    icon: "exclamationmark.triangle",
                    title: "Error al cargar",
                    message: error,
                    actionTitle: "Reintentar"
                ) {
                    Task { await viewModel.load() }
                }
            } else if viewModel.items.isEmpty {
                EmptyStateView(
                    icon: "calendar",
                    title: "Tu plan está vacío",
                    message: "Agrega tus gastos fijos e ingresos esperados para saber cuánto te queda cada mes.",
                    actionTitle: "Agregar gasto fijo"
                ) {
                    editorItem = .new(.bill)
                }
            } else {
                planList
            }
        }
        .navigationTitle("Plan mensual")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Menu {
                    Button { editorItem = .new(.bill) } label: {
                        Label("Gasto fijo", systemImage: "arrow.down.right")
                    }
                    Button { editorItem = .new(.income) } label: {
                        Label("Ingreso esperado", systemImage: "arrow.up.right")
                    }
                } label: {
                    Image(systemName: "plus")
                }
                .accessibilityLabel("Agregar ítem al plan")
            }
        }
        .sheet(item: $editorItem) { target in
            MonthlyPlanFormView(viewModel: viewModel, target: target)
        }
        .task {
            if viewModel.items.isEmpty {
                await viewModel.load()
            }
        }
        .errorBanner(isPresented: $viewModel.showErrorBanner, message: viewModel.errorBannerMessage)
        .toast(isPresented: $viewModel.showToast, type: viewModel.toastType, message: viewModel.toastMessage)
        .deleteConfirmation(isPresented: $showDeleteConfirmation, itemName: "ítem del plan") {
            if let item = itemToDelete {
                Task { await viewModel.delete(item) }
            }
        }
    }

    // MARK: - List

    private var planList: some View {
        List {
            if let summary = viewModel.summary {
                Section {
                    MonthlyPlanSummaryCard(summary: summary)
                        .listRowInsets(EdgeInsets())
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                }
            }

            Section {
                Picker("Agrupar por", selection: $viewModel.grouping) {
                    ForEach(MonthlyPlanViewModel.Grouping.allCases) { grouping in
                        Text(grouping.title).tag(grouping)
                    }
                }
                .pickerStyle(.segmented)
                .listRowInsets(EdgeInsets())
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
            } footer: {
                if viewModel.pausedCount > 0 {
                    Toggle("Mostrar pausados (\(viewModel.pausedCount))", isOn: $viewModel.showPaused)
                        .font(.app(.footnote))
                        .tint(Color.app.accent)
                        .padding(.top, .sm)
                }
            }

            ForEach(viewModel.groups) { group in
                Section {
                    ForEach(group.items) { item in
                        row(for: item)
                    }
                } header: {
                    groupHeader(group)
                }
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .refreshable { await viewModel.load() }
    }

    private func groupHeader(_ group: MonthlyPlanGroup) -> some View {
        HStack {
            Text("\(group.title) · \(group.items.count)")
            Spacer()
            if let share = group.share {
                Text("\(Int((share * 100).rounded()))% del gasto")
            } else {
                AmountText(value: group.total, tone: .positive)
            }
        }
        .font(.app(.footnote))
        .fontWeight(.medium)
        .foregroundStyle(Color.app.textSecondary)
    }

    private func row(for item: MonthlyPlanItem) -> some View {
        Button {
            editorItem = .edit(item)
        } label: {
            MonthlyPlanItemRow(
                item: item,
                subtitle: subtitle(for: item),
                subtitleTone: subtitleTone(for: item)
            )
        }
        .buttonStyle(.plain)
        .listRowBackground(Color.app.surface)
        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
            Button(role: .destructive) {
                itemToDelete = item
                showDeleteConfirmation = true
            } label: {
                Label("Eliminar", systemImage: "trash")
            }
            Button {
                Task { await viewModel.toggleActive(item) }
            } label: {
                Label(item.isActive ? "Pausar" : "Reactivar", systemImage: item.isActive ? "pause" : "play")
            }
            .tint(Color.app.textSecondary)
        }
    }

    private func subtitle(for item: MonthlyPlanItem) -> String {
        if !item.isActive { return "Pausado" }
        if !item.isIncome, let days = viewModel.daysUntilDue(item), days <= 7 {
            switch days {
            case 0: return "Vence hoy"
            case 1: return "Vence mañana"
            default: return "Vence en \(days) días"
            }
        }
        if !item.description.isEmpty { return item.description }
        return item.isIncome ? "Ingreso esperado" : viewModel.categoryName(for: item.categoryId)
    }

    private func subtitleTone(for item: MonthlyPlanItem) -> Color {
        guard item.isActive, !item.isIncome, let days = viewModel.daysUntilDue(item), days <= 7 else {
            return Color.app.textSecondary
        }
        return Color.app.warning
    }
}

// MARK: - Editor target

enum MonthlyPlanEditorTarget: Identifiable {
    case new(MonthlyPlanItem.ItemType)
    case edit(MonthlyPlanItem)

    var id: String {
        switch self {
        case .new(let type): "new-\(type.rawValue)"
        case .edit(let item): item.id
        }
    }
}

// MARK: - Summary card

struct MonthlyPlanSummaryCard: View {
    let summary: MonthlyPlanSummary

    private var committedFraction: Double {
        min(max(summary.committedPercentage / 100, 0), 1)
    }

    var body: some View {
        SurfaceCard(cornerRadius: .lg, padding: .lg) {
            VStack(alignment: .leading, spacing: .md) {
                HStack(alignment: .top, spacing: .sm) {
                    figure("Ingresos fijos", value: summary.totalIncome, tone: .positive, hint: count(summary.incomeCount, one: "ingreso", other: "ingresos"))
                    figure("Gastos fijos", value: summary.totalExpenses, tone: .negative, hint: count(summary.expensesCount, one: "activo", other: "activos"))
                    figure("Disponible", value: summary.available, tone: summary.isOvercommitted ? .negative : .neutral, hint: "después de lo fijo")
                }

                VStack(alignment: .leading, spacing: .xs) {
                    ProgressView(value: committedFraction)
                        .tint(summary.isOvercommitted ? Color.app.error : Color.app.accent)
                    Text(summary.isOvercommitted
                        ? "Tus gastos fijos superan tus ingresos"
                        : "\(Int(summary.committedPercentage.rounded()))% comprometido")
                        .font(.app(.caption))
                        .foregroundStyle(summary.isOvercommitted ? Color.app.error : Color.app.textSecondary)
                }

                if summary.usdToDopRate > 0 {
                    Text("Montos en USD convertidos a \(summary.usdToDopRate.currencyFormatted) por dólar.")
                        .font(.app(.caption))
                        .foregroundStyle(Color.app.textSecondary)
                }
            }
        }
    }

    private func figure(_ title: String, value: Double, tone: AmountText.Tone, hint: String) -> some View {
        VStack(alignment: .leading, spacing: .xxs) {
            Text(title)
                .font(.app(.caption))
                .fontWeight(.medium)
                .foregroundStyle(Color.app.textSecondary)
            AmountText(value: value, tone: tone)
                .font(.app(.headline))
                .lineLimit(1)
                .minimumScaleFactor(0.6)
            Text(hint)
                .font(.app(.caption))
                .foregroundStyle(Color.app.textSecondary)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }

    private func count(_ n: Int, one: String, other: String) -> String {
        "\(n) \(n == 1 ? one : other)"
    }
}

// MARK: - Row

struct MonthlyPlanItemRow: View {
    let item: MonthlyPlanItem
    let subtitle: String
    var subtitleTone: Color = Color.app.textSecondary

    var body: some View {
        HStack(spacing: .md) {
            VStack(spacing: 0) {
                Text("DÍA")
                    .font(.app(.caption2))
                    .foregroundStyle(Color.app.textSecondary)
                Text(item.dayOfMonth.map(String.init) ?? "—")
                    .font(.app(.headline))
                    .monospacedDigit()
                    .foregroundStyle(Color.app.textPrimary)
            }
            .frame(width: 36)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(item.dayOfMonth.map { "Día \($0)" } ?? "Sin día fijo")

            VStack(alignment: .leading, spacing: 2) {
                Text(item.name)
                    .font(.app(.callout))
                    .foregroundStyle(Color.app.textPrimary)
                    .lineLimit(1)
                Text(subtitle)
                    .font(.app(.footnote))
                    .foregroundStyle(subtitleTone)
                    .lineLimit(1)
            }

            Spacer(minLength: .sm)

            VStack(alignment: .trailing, spacing: 2) {
                AmountText(
                    value: item.amount,
                    currency: item.currency,
                    tone: item.isIncome ? .positive : .neutral,
                    signed: item.isIncome
                )
                .font(.app(.callout))
                .fontWeight(.medium)
                if item.currency.uppercased() == "USD" {
                    Text("≈ \(item.amountDop.currencyFormatted)")
                        .font(.app(.caption))
                        .monospacedDigit()
                        .foregroundStyle(Color.app.textSecondary)
                }
            }
        }
        .padding(.vertical, .xxs)
        .opacity(item.isActive ? 1 : 0.55)
        .contentShape(Rectangle())
    }
}

#Preview {
    NavigationStack {
        MonthlyPlanView()
    }
}
