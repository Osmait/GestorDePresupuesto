import SwiftUI

struct PrimaryButton: View {
    let title: String
    let icon: String?
    let isLoading: Bool
    let action: () -> Void
    
    init(
        _ title: String,
        icon: String? = nil,
        isLoading: Bool = false,
        action: @escaping () -> Void
    ) {
        self.title = title
        self.icon = icon
        self.isLoading = isLoading
        self.action = action
    }
    
    var body: some View {
        Button(action: action) {
            HStack(spacing: .sm) {
                if isLoading {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                } else {
                    if let icon = icon {
                        Image(systemName: icon)
                    }
                    Text(title)
                        .fontWeight(.semibold)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(Spacing.lg)
            .background(
                LinearGradient(
                    colors: Color.app.gradientPrimary,
                    startPoint: .leading,
                    endPoint: .trailing
                )
            )
            .cornerRadius(Radius.lg)
            .foregroundStyle(.white)
        }
        .disabled(isLoading)
        .buttonStyle(ScaleButtonStyle())
    }
}

struct SecondaryButton: View {
    let title: String
    let icon: String?
    let action: () -> Void
    
    init(
        _ title: String,
        icon: String? = nil,
        action: @escaping () -> Void
    ) {
        self.title = title
        self.icon = icon
        self.action = action
    }
    
    var body: some View {
        Button(action: action) {
            HStack(spacing: .sm) {
                if let icon = icon {
                    Image(systemName: icon)
                }
                Text(title)
                    .fontWeight(.medium)
            }
            .frame(maxWidth: .infinity)
            .padding(Spacing.lg)
            .background(Color.app.surface)
            .cornerRadius(Radius.lg)
            .overlay(
                RoundedRectangle(cornerRadius: Radius.lg.rawValue)
                    .stroke(Color.app.border, lineWidth: 1)
            )
            .foregroundStyle(Color.app.textPrimary)
        }
        .buttonStyle(ScaleButtonStyle())
    }
}

struct IconButton: View {
    let icon: String
    let color: Color
    let size: CGFloat
    let action: () -> Void
    
    init(
        _ icon: String,
        color: Color = .app.accent,
        size: CGFloat = 44,
        action: @escaping () -> Void
    ) {
        self.icon = icon
        self.color = color
        self.size = size
        self.action = action
    }
    
    var body: some View {
        Button(action: action) {
            ZStack {
                Circle()
                    .fill(color.opacity(0.15))
                    .frame(width: size, height: size)
                
                Image(systemName: icon)
                    .font(.system(size: size * 0.45, weight: .medium))
                    .foregroundStyle(color)
            }
        }
        .buttonStyle(ScaleButtonStyle())
    }
}

struct FAB: View {
    let icon: String
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            ZStack {
                LinearGradient(
                    colors: Color.app.gradientPrimary,
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .frame(width: 56, height: 56)
                .clipShape(Circle())
                .shadow(color: Color.app.accent.opacity(0.4), radius: 8, x: 0, y: 4)
                
                Image(systemName: icon)
                    .font(.title2)
                    .fontWeight(.semibold)
                    .foregroundStyle(.white)
            }
        }
        .buttonStyle(ScaleButtonStyle())
    }
}

struct ScaleButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.95 : 1)
            .animation(.easeInOut(duration: 0.15), value: configuration.isPressed)
    }
}

#Preview {
    ZStack {
        Color.app.background.ignoresSafeArea()
        
        VStack(spacing: 20) {
            PrimaryButton("Iniciar Sesión", icon: "arrow.right") {}
            
            SecondaryButton("Crear Cuenta", icon: "person.badge.plus") {}
            
            HStack(spacing: 16) {
                IconButton("plus") {}
                IconButton("heart.fill", color: .app.error) {}
                IconButton("star.fill", color: .app.warning) {}
            }
            
            FAB(icon: "plus") {}
        }
        .padding()
    }
}
