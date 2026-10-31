import SwiftUI

struct ErrorBanner: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    let message: String
    let onDismiss: () -> Void

    @State private var offset: CGFloat = -100
    @State private var opacity: Double = 0
    @State private var dismissTask: Task<Void, Never>?

    var body: some View {
        HStack(spacing: .sm) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(.body, weight: .medium))
                .foregroundStyle(Color.app.onStatus)

            Text(message)
                .font(.app(.subheadline))
                .fontWeight(.medium)
                .foregroundStyle(Color.app.onStatus)
                .lineLimit(2)

            Spacer()

            Button {
                dismissWithAnimation()
            } label: {
                Image(systemName: "xmark")
                    .font(.caption)
                    .foregroundStyle(Color.app.onStatus.opacity(0.8))
            }
            .accessibilityLabel("Cerrar error")
        }
        .padding(Spacing.md)
        .background(
            Color.app.error
        )
        .cornerRadius(Radius.md)
        .shadow(color: Color.app.error.opacity(0.3), radius: 8, x: 0, y: 4)
        .offset(y: reduceMotion ? 0 : offset)
        .opacity(opacity)
        .onAppear {
            withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
                offset = 0
                opacity = 1
            }

            let generator = UINotificationFeedbackGenerator()
            generator.notificationOccurred(.error)

            dismissTask = Task {
                try? await Task.sleep(nanoseconds: 5_000_000_000)
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
            offset = -100
            opacity = 0
        }

        Task {
            try? await Task.sleep(nanoseconds: 300_000_000)
            guard !Task.isCancelled else { return }
            onDismiss()
        }
    }
}

struct ErrorBannerModifier: ViewModifier {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Binding var isPresented: Bool
    let message: String

    func body(content: Content) -> some View {
        content
            .overlay(alignment: .top) {
                if isPresented {
                    ErrorBanner(message: message) {
                        isPresented = false
                    }
                    .padding(.horizontal)
                    .padding(.top, 8)
                    .transition(reduceMotion ? .opacity : .move(edge: .top).combined(with: .opacity))
                }
            }
    }
}

extension View {
    func errorBanner(isPresented: Binding<Bool>, message: String) -> some View {
        self.modifier(ErrorBannerModifier(isPresented: isPresented, message: message))
    }
}

#Preview {
    ZStack {
        Color.app.background.ignoresSafeArea()

        VStack {
            ErrorBanner(message: "Error de conexión. Verifica tu conexión a internet.") {}
                .padding()

            Spacer()
        }
    }
}
