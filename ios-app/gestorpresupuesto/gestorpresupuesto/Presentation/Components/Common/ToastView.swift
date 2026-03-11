import SwiftUI

enum ToastType {
    case success
    case error
    case warning
    case info

    var icon: String {
        switch self {
        case .success: return "checkmark.circle.fill"
        case .error: return "xmark.circle.fill"
        case .warning: return "exclamationmark.triangle.fill"
        case .info: return "info.circle.fill"
        }
    }

    var color: Color {
        switch self {
        case .success: return .app.success
        case .error: return .app.error
        case .warning: return .app.warning
        case .info: return .app.info
        }
    }

    var backgroundColor: Color {
        switch self {
        case .success: return Color.app.success.opacity(0.15)
        case .error: return Color.app.error.opacity(0.15)
        case .warning: return Color.app.warning.opacity(0.15)
        case .info: return Color.app.info.opacity(0.15)
        }
    }
}

struct ToastView: View {
    let type: ToastType
    let message: String
    let onDismiss: () -> Void

    @State private var offset: CGFloat = 100
    @State private var opacity: Double = 0
    @State private var dismissTask: Task<Void, Never>?

    var body: some View {
        HStack(spacing: .sm) {
            Image(systemName: type.icon)
                .font(.system(size: 20, weight: .medium))
                .foregroundStyle(type.color)

            Text(message)
                .font(.app(.subheadline))
                .foregroundStyle(Color.app.textPrimary)
                .lineLimit(2)

            Spacer()

            Button {
                dismissWithAnimation()
            } label: {
                Image(systemName: "xmark")
                    .font(.caption)
                    .foregroundStyle(Color.app.textTertiary)
            }
            .accessibilityLabel("Cerrar notificación")
        }
        .padding(Spacing.md)
        .background(
            RoundedRectangle(cornerRadius: Radius.lg.rawValue)
                .fill(.ultraThinMaterial)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radius.lg.rawValue)
                .stroke(type.color.opacity(0.3), lineWidth: 1)
        )
        .shadow(color: Color.black.opacity(0.1), radius: 10, x: 0, y: 5)
        .offset(y: offset)
        .opacity(opacity)
        .onAppear {
            withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
                offset = 0
                opacity = 1
            }

            dismissTask = Task {
                try? await Task.sleep(nanoseconds: 3_000_000_000)
                guard !Task.isCancelled else { return }
                dismissWithAnimation()
            }
        }
        .onDisappear {
            dismissTask?.cancel()
        }
    }

    private func dismissWithAnimation() {
        dismissTask?.cancel()
        withAnimation(.easeOut(duration: 0.3)) {
            offset = 100
            opacity = 0
        }

        Task {
            try? await Task.sleep(nanoseconds: 300_000_000)
            guard !Task.isCancelled else { return }
            onDismiss()
        }
    }
}

struct ToastModifier: ViewModifier {
    @Binding var isPresented: Bool
    let type: ToastType
    let message: String

    func body(content: Content) -> some View {
        content
            .overlay(alignment: .bottom) {
                if isPresented {
                    ToastView(type: type, message: message) {
                        isPresented = false
                    }
                    .padding(.horizontal)
                    .padding(.bottom, 16)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
    }
}

extension View {
    func toast(isPresented: Binding<Bool>, type: ToastType, message: String) -> some View {
        self.modifier(ToastModifier(isPresented: isPresented, type: type, message: message))
    }
}

#Preview {
    ZStack {
        Color.app.background.ignoresSafeArea()

        VStack(spacing: 20) {
            ToastView(type: .success, message: "Guardado exitosamente") {}
            ToastView(type: .error, message: "Error al guardar los datos") {}
            ToastView(type: .warning, message: "El presupuesto está casi lleno") {}
            ToastView(type: .info, message: "Nueva actualización disponible") {}
        }
        .padding()
    }
}
