import SwiftUI

struct NotificationToolbarModifier: ViewModifier {
    @EnvironmentObject private var notificationManager: NotificationManager

    func body(content: Content) -> some View {
        content
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        notificationManager.showNotificationCenter = true
                    } label: {
                        ZStack(alignment: .topTrailing) {
                            Image(systemName: "bell.fill")
                                .font(.system(size: 15))

                            if notificationManager.unreadCount > 0 {
                                Text(notificationManager.unreadCount > 9 ? "9+" : "\(notificationManager.unreadCount)")
                                    .font(.system(size: 8, weight: .bold))
                                    .foregroundStyle(.white)
                                    .padding(.horizontal, 3)
                                    .frame(minWidth: 14, minHeight: 14)
                                    .background(Color.app.error, in: Capsule())
                                    .offset(x: 6, y: -6)
                            }
                        }
                    }
                }
            }
    }
}

extension View {
    func notificationToolbar() -> some View {
        self.modifier(NotificationToolbarModifier())
    }
}
