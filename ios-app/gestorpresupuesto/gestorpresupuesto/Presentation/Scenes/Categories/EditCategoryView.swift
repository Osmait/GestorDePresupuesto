import SwiftUI

struct EditCategoryView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var viewModel: CategoriesViewModel

    let category: Category

    @State private var name: String
    @State private var selectedIcon: String
    @State private var selectedColor: String
    @State private var isLoading = false
    @State private var shakeTrigger = false

    private let categoryIcons = [
        "🍔", "🍕", "☕", "🛒", "🚗", "⛽", "🏠", "💡",
        "💧", "📱", "🎬", "🎮", "👕", "💊", "📚", "🎵",
        "✈️", "🎁", "💼", "🏋️", "💇", "🐶", "👶", "🎓",
        "💰", "💳", "🏦", "📊", "🔧", "🧹", "🍺", "🎉"
    ]

    private let categoryColors = [
        "#EF4444", "#F97316", "#F59E0B", "#84CC16",
        "#22C55E", "#14B8A6", "#06B6D4", "#3B82F6",
        "#6366F1", "#8B5CF6", "#A855F7", "#EC4899",
        "#F43F5E", "#78716C", "#64748B", "#0EA5E9"
    ]

    init(viewModel: CategoriesViewModel, category: Category) {
        self.viewModel = viewModel
        self.category = category
        _name = State(initialValue: category.name)
        _selectedIcon = State(initialValue: category.icon)
        _selectedColor = State(initialValue: category.color)
    }

    private var isValid: Bool { !name.isEmpty }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.app.background.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: Spacing.xl.rawValue) {
                        // Live preview
                        categoryPreview

                        // Name
                        FormField(
                            icon: "tag",
                            placeholder: "Nombre de la categoría",
                            text: $name,
                            validation: { $0.nameError }
                        )

                        // Icon picker
                        iconPicker

                        // Color picker
                        colorPicker

                        // Save
                        PrimaryButton(
                            "Guardar Cambios",
                            icon: "checkmark",
                            isLoading: isLoading
                        ) {
                            Task { await save() }
                        }
                        .disabled(!isValid)
                    }
                    .padding(Spacing.lg.rawValue)
                }
                .shake(trigger: shakeTrigger)
            }
            .navigationTitle("Editar Categoría")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { dismiss() }
                }
            }
        }
    }

    // MARK: - Preview

    private var categoryPreview: some View {
        VStack(spacing: Spacing.md.rawValue) {
            ZStack {
                Circle()
                    .fill((Color.fromHex(selectedColor) ?? .blue).opacity(0.15))
                    .frame(width: 80, height: 80)

                Text(selectedIcon)
                    .font(.system(size: 40))
            }

            Text(name.isEmpty ? "Mi Categoría" : name)
                .font(.app(.headline))
                .foregroundStyle(Color.app.textPrimary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.lg.rawValue)
        .background(
            RoundedRectangle(cornerRadius: Radius.xl.rawValue)
                .fill(Color.app.surface)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radius.xl.rawValue)
                .stroke(Color.app.border.opacity(0.2), lineWidth: 1)
        )
    }

    // MARK: - Icon Picker

    private var iconPicker: some View {
        VStack(alignment: .leading, spacing: Spacing.sm.rawValue) {
            Text("Ícono")
                .font(.app(.subheadline))
                .fontWeight(.semibold)
                .foregroundStyle(Color.app.textPrimary)

            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: Spacing.xs.rawValue), count: 8), spacing: Spacing.xs.rawValue) {
                ForEach(categoryIcons, id: \.self) { icon in
                    Button {
                        selectedIcon = icon
                        HapticManager.shared.selection()
                    } label: {
                        Text(icon)
                            .font(.title3)
                            .frame(maxWidth: .infinity)
                            .frame(height: 44)
                            .background(
                                RoundedRectangle(cornerRadius: Radius.md.rawValue)
                                    .fill(selectedIcon == icon
                                        ? (Color.fromHex(selectedColor) ?? .blue).opacity(0.2)
                                        : Color.app.surfaceSecondary)
                            )
                            .overlay(
                                RoundedRectangle(cornerRadius: Radius.md.rawValue)
                                    .stroke(selectedIcon == icon
                                        ? (Color.fromHex(selectedColor) ?? .blue).opacity(0.5)
                                        : Color.clear, lineWidth: 2)
                            )
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    // MARK: - Color Picker

    private var colorPicker: some View {
        VStack(alignment: .leading, spacing: Spacing.sm.rawValue) {
            Text("Color")
                .font(.app(.subheadline))
                .fontWeight(.semibold)
                .foregroundStyle(Color.app.textPrimary)

            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: Spacing.sm.rawValue), count: 8), spacing: Spacing.sm.rawValue) {
                ForEach(categoryColors, id: \.self) { hex in
                    Button {
                        selectedColor = hex
                        HapticManager.shared.selection()
                    } label: {
                        Circle()
                            .fill(Color.fromHex(hex) ?? .gray)
                            .frame(width: 36, height: 36)
                            .overlay {
                                if selectedColor == hex {
                                    Image(systemName: "checkmark")
                                        .font(.system(size: 14, weight: .bold))
                                        .foregroundStyle(.white)
                                }
                            }
                            .overlay(
                                Circle()
                                    .stroke(selectedColor == hex ? Color.app.textPrimary.opacity(0.4) : .clear, lineWidth: 2)
                                    .padding(-2)
                            )
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    // MARK: - Save

    private func save() async {
        isLoading = true

        let request = UpdateCategoryRequest(
            name: name,
            icon: selectedIcon,
            color: selectedColor
        )

        do {
            _ = try await viewModel.updateCategory(category.id, request: request)
            dismiss()
        } catch {
            shakeTrigger = false
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
                shakeTrigger = true
            }
        }

        isLoading = false
    }
}
