import SwiftUI

struct CategoriesListView: View {
    @StateObject private var viewModel = CategoriesViewModel()
    @State private var showingAddCategory = false
    @State private var editingCategory: Category?
    @State private var showDeleteConfirmation = false
    @State private var categoryToDelete: Category?

    var body: some View {
        NavigationStack {
            ZStack {
                Color.app.background.ignoresSafeArea()

                Group {
                    if viewModel.categories.isEmpty && viewModel.isLoading {
                        VStack(spacing: Spacing.md.rawValue) {
                            ForEach(0..<6, id: \.self) { _ in CardSkeleton() }
                        }
                        .padding()
                    } else if viewModel.categories.isEmpty {
                        EmptyStateView(
                            icon: "tag",
                            title: "Sin categorías",
                            message: "Crea tu primera categoría para organizar tus transacciones.",
                            actionTitle: "Crear categoría",
                            action: { showingAddCategory = true }
                        )
                    } else {
                        ScrollView {
                            VStack(spacing: 0) {
                                // Header
                                categoriesHeader
                                    .padding(.bottom, Spacing.lg.rawValue)

                                // Grid
                                let columns = [
                                    GridItem(.flexible(), spacing: Spacing.sm.rawValue),
                                    GridItem(.flexible(), spacing: Spacing.sm.rawValue)
                                ]

                                LazyVGrid(columns: columns, spacing: Spacing.sm.rawValue) {
                                    ForEach(viewModel.categories) { category in
                                        categoryCard(category)
                                            .onTapGesture {
                                                editingCategory = category
                                            }
                                            .contextMenu {
                                                Button {
                                                    editingCategory = category
                                                } label: {
                                                    Label("Editar", systemImage: "pencil")
                                                }
                                                Button(role: .destructive) {
                                                    categoryToDelete = category
                                                    showDeleteConfirmation = true
                                                } label: {
                                                    Label("Eliminar", systemImage: "trash")
                                                }
                                            }
                                    }
                                }
                            }
                            .padding(.horizontal, Spacing.lg.rawValue)
                            .padding(.bottom, Spacing.xl.rawValue)
                        }
                        .refreshable {
                            await viewModel.loadCategories()
                        }
                    }
                }
            }
            .navigationTitle("Categorías")
            .notificationToolbar()
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button { showingAddCategory = true } label: {
                        ZStack {
                            Circle()
                                .fill(Color.app.accent.opacity(0.15))
                                .frame(width: 32, height: 32)
                            Image(systemName: "plus")
                                .font(.system(size: 14, weight: .bold))
                                .foregroundStyle(Color.app.accent)
                        }
                    }
                }
            }
            .sheet(isPresented: $showingAddCategory) {
                AddCategoryView(viewModel: viewModel, isPresented: $showingAddCategory)
            }
            .sheet(item: $editingCategory) { category in
                EditCategoryView(viewModel: viewModel, category: category)
            }
            .task {
                if viewModel.categories.isEmpty {
                    await viewModel.loadCategories()
                }
            }
            .errorBanner(isPresented: $viewModel.showErrorBanner, message: viewModel.errorBannerMessage)
            .toast(isPresented: $viewModel.showToast, type: viewModel.toastType, message: viewModel.toastMessage)
            .deleteConfirmation(isPresented: $showDeleteConfirmation, itemName: "categoría") {
                if let category = categoryToDelete {
                    Task { await viewModel.deleteCategory(category.id) }
                }
            }
        }
    }

    // MARK: - Header

    private var categoriesHeader: some View {
        VStack(spacing: Spacing.sm.rawValue) {
            Text("Total de categorías")
                .font(.app(.caption))
                .foregroundStyle(Color.app.textTertiary)

            Text("\(viewModel.categories.count)")
                .font(.system(size: 36, weight: .bold, design: .rounded))
                .foregroundStyle(Color.app.textPrimary)

            Text("categoría\(viewModel.categories.count == 1 ? "" : "s") creada\(viewModel.categories.count == 1 ? "" : "s")")
                .font(.app(.caption))
                .foregroundStyle(Color.app.textSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.lg.rawValue)
    }

    // MARK: - Category Card

    private func categoryCard(_ category: Category) -> some View {
        VStack(spacing: Spacing.sm.rawValue) {
            ZStack {
                RoundedRectangle(cornerRadius: Radius.lg.rawValue)
                    .fill(category.colorValue.opacity(0.12))
                    .frame(width: 56, height: 56)

                Text(category.icon)
                    .font(.system(size: 28))
            }

            Text(category.name)
                .font(.app(.subheadline))
                .fontWeight(.semibold)
                .foregroundStyle(Color.app.textPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.lg.rawValue)
        .padding(.horizontal, Spacing.sm.rawValue)
        .background(
            RoundedRectangle(cornerRadius: Radius.lg.rawValue)
                .fill(Color.app.surface)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radius.lg.rawValue)
                .stroke(Color.app.border.opacity(0.2), lineWidth: 1)
        )
    }
}

// MARK: - Add Category View

struct AddCategoryView: View {
    @ObservedObject var viewModel: CategoriesViewModel
    @Binding var isPresented: Bool

    @State private var name = ""
    @State private var selectedIcon = "🍔"
    @State private var selectedColor = "#3B82F6"
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
                            "Crear Categoría",
                            icon: "checkmark",
                            isLoading: isLoading
                        ) {
                            Task { await saveCategory() }
                        }
                        .disabled(!isValid)
                    }
                    .padding(Spacing.lg.rawValue)
                }
                .shake(trigger: shakeTrigger)
            }
            .navigationTitle("Nueva Categoría")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { isPresented = false }
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

    private func saveCategory() async {
        isLoading = true

        let request = CreateCategoryRequest(
            name: name,
            icon: selectedIcon,
            color: selectedColor
        )

        do {
            _ = try await viewModel.createCategory(request: request)
            isPresented = false
        } catch {
            shakeTrigger = false
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
                shakeTrigger = true
            }
        }

        isLoading = false
    }
}

#Preview {
    CategoriesListView()
}
