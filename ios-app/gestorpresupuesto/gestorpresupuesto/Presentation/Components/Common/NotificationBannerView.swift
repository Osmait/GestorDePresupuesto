import SwiftUI

struct NotificationBannerView: View {
    let event: NotificationEvent
    let onDismiss: () -> Void
    let onTap: () -> Void

    @State private var offset: CGFloat = -100
    @State private var opacity: Double = 0
    @State private var dismissTask: Task<Void, Never>?

    var body: some View {
        let type = event.notificationType

        Button(action: onTap) {
            HStack(spacing: .sm) {
                Image(systemName: type.icon)
                    .font(.system(size: 20, weight: .medium))
                    .foregroundStyle(type.toastType.color)

                VStack(alignment: .leading, spacing: 2) {
                    Text(event.message)
                        .font(.app(.subheadline))
                        .foregroundStyle(Color.app.textPrimary)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)

                    if let amount = event.amount {
                        Text(amount.currencyFormatted)
                            .font(.app(.caption))
                            .foregroundStyle(Color.app.textSecondary)
                    }
                }

                Spacer()

                Button {
                    dismissWithAnimation()
                } label: {
                    Image(systemName: "xmark")
                        .font(.caption)
                        .foregroundStyle(Color.app.textTertiary)
                }
                .accessibilityLabel("Cerrar")
            }
            .padding(Spacing.md)
            .background(
                RoundedRectangle(cornerRadius: Radius.lg.rawValue)
                    .fill(.ultraThinMaterial)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radius.lg.rawValue)
                    .stroke(type.toastType.color.opacity(0.3), lineWidth: 1)
            )
            .shadow(color: Color.black.opacity(0.1), radius: 10, x: 0, y: 5)
        }
        .buttonStyle(.plain)
        .offset(y: offset)
        .opacity(opacity)
        .onAppear {
            withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
                offset = 0
                opacity = 1
            }

            dismissTask = Task {
                try? await Task.sleep(nanoseconds: 4_000_000_000)
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

struct NotificationBannerModifier: ViewModifier {
    @Binding var isPresented: Bool
    let event: NotificationEvent?
    let onTap: () -> Void

    func body(content: Content) -> some View {
        content
            .overlay(alignment: .top) {
                if isPresented, let event {
                    NotificationBannerView(
                        event: event,
                        onDismiss: { isPresented = false },
                        onTap: {
                            isPresented = false
                            onTap()
                        }
                    )
                    .padding(.horizontal)
                    .padding(.top, 8)
                    .transition(.move(edge: .top).combined(with: .opacity))
                }
            }
    }
}

extension View {
    func notificationBanner(
        isPresented: Binding<Bool>,
        event: NotificationEvent?,
        onTap: @escaping () -> Void
    ) -> some View {
        self.modifier(NotificationBannerModifier(isPresented: isPresented, event: event, onTap: onTap))
    }
}
