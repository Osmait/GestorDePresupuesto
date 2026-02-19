import SwiftUI

struct CategoriesListView: View {
    @StateObject private var viewModel = CategoriesViewModel()
    @State private var showingAddCategory = false
    
    var body: some View {
        NavigationStack {
            ZStack {
            Color.app.background.ignoresSafeArea()
            
            Group {
                if viewModel.categories.isEmpty && viewModel.isLoading {
                    VStack(spacing: .md) {
                        ForEach(0..<4, id: \.self) { _ in CardSkeleton() }
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
                    List {
                        ForEach(viewModel.categories) { category in
                            CategoryRowView(category: category)
                                .listRowBackground(Color.clear)
                                .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16))
                                .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                                    Button(role: .destructive) {
                                        Task { await viewModel.deleteCategory(category.id) }
                                    } label: {
                                        Label("Eliminar", systemImage: "trash")
                                    }
                                }
                        }
                    }
                    .listStyle(.plain)
                    .scrollContentBackground(.hidden)
                    .refreshable {
                        await viewModel.loadCategories()
                    }
                }
            }
        }
        .navigationTitle("Categorías")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                IconButton("plus") {
                    showingAddCategory = true
                }
            }
        }
        .sheet(isPresented: $showingAddCategory) {
            AddCategoryView(viewModel: viewModel, isPresented: $showingAddCategory)
        }
        .task {
            if viewModel.categories.isEmpty {
                await viewModel.loadCategories()
            }
        }
        .errorBanner(isPresented: $viewModel.showErrorBanner, message: viewModel.errorBannerMessage)
        .toast(isPresented: $viewModel.showToast, type: viewModel.toastType, message: viewModel.toastMessage)
        }
    }
}

struct CategoryRowView: View {
    let category: Category
    
    var body: some View {
        GlassCard(cornerRadius: .lg, padding: .md) {
            HStack(spacing: .md) {
                ZStack {
                    RoundedRectangle(cornerRadius: Radius.md.rawValue)
                        .fill(category.colorValue.opacity(0.15))
                        .frame(width: 50, height: 50)
                    
                    Text(category.icon)
                        .font(.title2)
                }
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(category.name)
                        .font(.app(.headline))
                        .foregroundStyle(Color.app.textPrimary)
                    
                    Text("Categoría")
                        .font(.caption)
                        .foregroundStyle(Color.app.textSecondary)
                }
                
                Spacer()
                
                Circle()
                    .fill(category.colorValue)
                    .frame(width: 12, height: 12)
            }
        }
    }
}

struct AddCategoryView: View {
    @ObservedObject var viewModel: CategoriesViewModel
    @Binding var isPresented: Bool
    
    @State private var name = ""
    @State private var selectedIcon = "📁"
    @State private var selectedColor = "#3B82F6"
    @State private var isLoading = false
    @State private var shakeOffset: CGFloat = 0
    
    private let commonIcons = ["🍔", "🚗", "🏠", "💡", "🎬", "👕", "💊", "📚", "🎮", "✈️", "🎁", "💼", "🛒", "🏋️", "🎵", "📱"]
    private let commonColors = ["#EF4444", "#F97316", "#F59E0B", "#22C55E", "#14B8A6", "#3B82F6", "#8B5CF6", "#EC4899", "#6366F1", "#64748B"]
    
    private var isValid: Bool {
        !name.isEmpty
    }
    
    var body: some View {
        NavigationStack {
            ZStack {
                Color.app.background.ignoresSafeArea()
                
                ScrollView {
                    GlassCard(cornerRadius: .xl, padding: .lg) {
                        VStack(spacing: .lg) {
                            Text("Nueva Categoría")
                                .font(.app(.title3))
                                .foregroundStyle(Color.app.textPrimary)
                            
                            VStack(spacing: .md) {
                                FormField(
                                    icon: "tag",
                                    placeholder: "Nombre de la categoría",
                                    text: $name,
                                    validation: { value in
                                        value.isEmpty ? "El nombre es requerido" : nil
                                    }
                                )
                                
                                VStack(alignment: .leading, spacing: .sm) {
                                    Text("Ícono")
                                        .font(.caption)
                                        .foregroundStyle(Color.app.textSecondary)
                                    
                                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 8), spacing: 8) {
                                        ForEach(commonIcons, id: \.self) { icon in
                                            Button {
                                                selectedIcon = icon
                                            } label: {
                                                Text(icon)
                                                    .font(.title2)
                                                    .frame(width: 44, height: 44)
                                                    .background(selectedIcon == icon ? Color.app.accent.opacity(0.2) : Color.app.surfaceSecondary)
                                                    .cornerRadius(.md)
                                            }
                                            .buttonStyle(PlainButtonStyle())
                                        }
                                    }
                                }
                                
                                VStack(alignment: .leading, spacing: .sm) {
                                    Text("Color")
                                        .font(.caption)
                                        .foregroundStyle(Color.app.textSecondary)
                                    
                                    HStack(spacing: .sm) {
                                        ForEach(commonColors, id: \.self) { color in
                                            Button {
                                                selectedColor = color
                                            } label: {
                                                Circle()
                                                    .fill(Color(hex: color))
                                                    .frame(width: 36, height: 36)
                                                    .overlay {
                                                        if selectedColor == color {
                                                            Image(systemName: "checkmark")
                                                                .font(.system(size: 14, weight: .bold))
                                                                .foregroundStyle(.white)
                                                        }
                                                    }
                                            }
                                            .buttonStyle(PlainButtonStyle())
                                        }
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
                                    Task { await saveCategory() }
                                }
                                .disabled(!isValid)
                            }
                        }
                    }
                    .padding()
                    .offset(x: shakeOffset)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
        }
    }
    
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
    CategoriesListView()
}
