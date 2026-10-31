import SwiftUI

/// Sheet to add or edit a monthly plan item.
struct MonthlyPlanFormView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var viewModel: MonthlyPlanViewModel

    private let editingId: String?
    /// Not editable here (the web form owns it); kept so saving does not clear it.
    private let accountId: String?

    @State private var type: MonthlyPlanItem.ItemType
    @State private var name: String
    @State private var amount: String
    @State private var currency: String
    @State private var hasDay: Bool
    @State private var dayOfMonth: Int
    @State private var categoryId: String
    @State private var description: String
    @State private var isActive: Bool
    @State private var isSaving = false

    init(viewModel: MonthlyPlanViewModel, target: MonthlyPlanEditorTarget) {
        self.viewModel = viewModel
        switch target {
        case .new(let type):
            editingId = nil
            accountId = nil
            _type = State(initialValue: type)
            _name = State(initialValue: "")
            _amount = State(initialValue: "")
            _currency = State(initialValue: "DOP")
            _hasDay = State(initialValue: true)
            _dayOfMonth = State(initialValue: Calendar.current.component(.day, from: Date()))
            _categoryId = State(initialValue: "")
            _description = State(initialValue: "")
            _isActive = State(initialValue: true)
        case .edit(let item):
            editingId = item.id
            accountId = item.accountId
            _type = State(initialValue: item.type)
            _name = State(initialValue: item.name)
            _amount = State(initialValue: String(format: "%.2f", item.amount))
            _currency = State(initialValue: item.currency.uppercased())
            _hasDay = State(initialValue: item.dayOfMonth != nil)
            _dayOfMonth = State(initialValue: item.dayOfMonth ?? 1)
            _categoryId = State(initialValue: item.categoryId ?? "")
            _description = State(initialValue: item.description)
            _isActive = State(initialValue: item.isActive)
        }
    }

    private var parsedAmount: Double? {
        Double(amount.replacingOccurrences(of: ",", with: ""))
    }

    private var isValid: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty && (parsedAmount ?? 0) > 0
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Picker("Tipo", selection: $type) {
                        Text("Gasto fijo").tag(MonthlyPlanItem.ItemType.bill)
                        Text("Ingreso").tag(MonthlyPlanItem.ItemType.income)
                    }
                    .pickerStyle(.segmented)
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)
                    .listRowInsets(EdgeInsets())
                }

                Section {
                    TextField("Nombre (ej. Alquiler)", text: $name)
                    HStack {
                        TextField("Monto", text: $amount)
                            .keyboardType(.decimalPad)
                            .monospacedDigit()
                        Picker("Moneda", selection: $currency) {
                            Text("RD$").tag("DOP")
                            Text("US$").tag("USD")
                        }
                        .pickerStyle(.segmented)
                        .frame(width: 120)
                        .labelsHidden()
                    }
                }

                Section {
                    Toggle("Día fijo del mes", isOn: $hasDay)
                        .tint(Color.app.accent)
                    if hasDay {
                        Picker("Día", selection: $dayOfMonth) {
                            ForEach(1...31, id: \.self) { day in
                                Text("\(day)").tag(day)
                            }
                        }
                    }
                } footer: {
                    if hasDay && dayOfMonth > 28 {
                        Text("En meses más cortos cae el último día.")
                    }
                }

                if type == .bill && !viewModel.categories.isEmpty {
                    Section {
                        Picker("Categoría", selection: $categoryId) {
                            Text("Sin categoría").tag("")
                            ForEach(viewModel.categories) { category in
                                Text(category.name).tag(category.id)
                            }
                        }
                    }
                }

                Section {
                    TextField("Nota (opcional)", text: $description, axis: .vertical)
                    if editingId != nil {
                        Toggle("Activo", isOn: $isActive)
                            .tint(Color.app.accent)
                    }
                } footer: {
                    if editingId != nil {
                        Text("Un ítem pausado deja de contar en los totales sin borrarse.")
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(Color.app.background)
            .navigationTitle(editingId == nil ? "Nuevo ítem" : "Editar ítem")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Guardar") {
                        Task { await save() }
                    }
                    .fontWeight(.semibold)
                    .disabled(!isValid || isSaving)
                }
            }
        }
    }

    private func save() async {
        guard let amountValue = parsedAmount else { return }
        isSaving = true
        defer { isSaving = false }

        let request = MonthlyPlanItemRequest(
            name: name.trimmingCharacters(in: .whitespaces),
            description: description.trimmingCharacters(in: .whitespacesAndNewlines),
            amount: amountValue,
            currency: currency,
            type: type,
            categoryId: type == .bill && !categoryId.isEmpty ? categoryId : nil,
            accountId: accountId,
            dayOfMonth: hasDay ? dayOfMonth : nil,
            isActive: isActive
        )
        do {
            try await viewModel.save(request, editing: editingId)
            dismiss()
        } catch {
            viewModel.showError(error.localizedDescription)
        }
    }
}
