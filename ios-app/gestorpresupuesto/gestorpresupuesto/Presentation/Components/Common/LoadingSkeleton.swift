import SwiftUI

struct LoadingSkeleton: View {
    var height: CGFloat = 20
    var cornerRadius: Radius = .sm
    
    @State private var isAnimating = false
    
    var body: some View {
        Rectangle()
            .fill(Color.app.surfaceSecondary)
            .frame(height: height)
            .cornerRadius(cornerRadius)
            .overlay(
                GeometryReader { geometry in
                    Rectangle()
                        .fill(
                            LinearGradient(
                                colors: [
                                    .clear,
                                    Color.primary.opacity(0.1),
                                    .clear
                                ],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .rotationEffect(.degrees(30))
                        .offset(x: isAnimating ? geometry.size.width * 2 : -geometry.size.width)
                }
            )
            .clipped()
            .onAppear {
                withAnimation(.linear(duration: 1.5).repeatForever(autoreverses: false)) {
                    isAnimating = true
                }
            }
    }
}

struct CardSkeleton: View {
    var body: some View {
        GlassCard(cornerRadius: .lg, padding: .lg) {
            VStack(alignment: .leading, spacing: .md) {
                HStack {
                    LoadingSkeleton(height: 40, cornerRadius: .full)
                        .frame(width: 40)
                    
                    VStack(alignment: .leading, spacing: .sm) {
                        LoadingSkeleton(height: 14)
                            .frame(width: 120)
                        LoadingSkeleton(height: 12)
                            .frame(width: 80)
                    }
                    
                    Spacer()
                    
                    LoadingSkeleton(height: 24, cornerRadius: .sm)
                        .frame(width: 60)
                }
            }
        }
    }
}

struct DashboardSkeleton: View {
    var body: some View {
        VStack(spacing: .lg) {
            GlassCard(cornerRadius: Radius.xl, padding: Spacing.xl) {
                VStack(spacing: .md) {
                    LoadingSkeleton(height: 16)
                        .frame(width: 100)
                    LoadingSkeleton(height: 40)
                        .frame(width: 180)
                    LoadingSkeleton(height: 12)
                        .frame(width: 200)
                }
            }
            
            HStack(spacing: .md) {
                CardSkeleton()
                CardSkeleton()
            }
            
            VStack(alignment: .leading, spacing: .md) {
                LoadingSkeleton(height: 20)
                    .frame(width: 150)
                CardSkeleton()
                CardSkeleton()
                CardSkeleton()
            }
        }
        .padding()
    }
}

struct EmptyStateView: View {
    let icon: String
    let title: String
    let message: String
    var actionTitle: String?
    var action: (() -> Void)?
    
    var body: some View {
        VStack(spacing: .lg) {
            ZStack {
                Circle()
                    .fill(Color.app.accent.opacity(0.1))
                    .frame(width: 100, height: 100)
                
                Image(systemName: icon)
                    .font(.system(size: 40))
                    .foregroundStyle(Color.app.accent)
            }
            
            VStack(spacing: .sm) {
                Text(title)
                    .font(.app(.headline))
                    .foregroundStyle(Color.app.textPrimary)
                
                Text(message)
                    .font(.app(.subheadline))
                    .foregroundStyle(Color.app.textSecondary)
                    .multilineTextAlignment(.center)
            }
            
            if let actionTitle = actionTitle, let action = action {
                PrimaryButton(actionTitle, icon: "plus", action: action)
                    .padding(.horizontal, .xxl)
            }
        }
        .padding(Spacing.xl)
    }
}

#Preview {
    ZStack {
        Color.app.background.ignoresSafeArea()
        
        ScrollView {
            VStack(spacing: 24) {
                Text("Loading Skeleton")
                    .font(.headline)
                
                LoadingSkeleton(height: 20)
                LoadingSkeleton(height: 40, cornerRadius: .md)
                
                Text("Card Skeleton")
                    .font(.headline)
                
                CardSkeleton()
                
                Text("Empty State")
                    .font(.headline)
                
                EmptyStateView(
                    icon: "tray",
                    title: "Sin transacciones",
                    message: "No tienes transacciones registradas aún.\nToca el botón para agregar tu primera.",
                    actionTitle: "Agregar transacción",
                    action: {}
                )
            }
            .padding()
        }
    }
}
