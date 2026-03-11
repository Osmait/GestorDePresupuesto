import SwiftUI

struct NotificationCenterView: View {
    @EnvironmentObject private var notificationManager: NotificationManager
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                connectionStatus
                notificationList
            }
            .background(Color.app.background)
            .navigationTitle("Notificaciones")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cerrar") { dismiss() }
                }

                ToolbarItem(placement: .primaryAction) {
                    Menu {
                        Button {
                            notificationManager.markAllAsRead()
                        } label: {
                            Label("Marcar todas como leídas", systemImage: "checkmark.circle")
                        }

                        Button(role: .destructive) {
                            notificationManager.deleteAll()
                        } label: {
                            Label("Eliminar todas", systemImage: "trash")
                        }

                        Divider()

                        Button {
                            notificationManager.sendTest()
                        } label: {
                            Label("Enviar prueba", systemImage: "paperplane")
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                }
            }
        }
    }

    // MARK: - Connection Status

    private var connectionStatus: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(notificationManager.isConnected ? Color.app.success : Color.app.error)
                .frame(width: 8, height: 8)

            Text(notificationManager.isConnected ? "Conectado" : "Desconectado")
                .font(.app(.caption))
                .foregroundStyle(Color.app.textSecondary)

            Spacer()
        }
        .padding(.horizontal, Spacing.lg)
        .padding(.vertical, Spacing.sm)
        .background(Color.app.surface)
    }

    // MARK: - List

    private var notificationList: some View {
        Group {
            if notificationManager.notifications.isEmpty {
                emptyState
            } else {
                List {
                    ForEach(notificationManager.notifications) { notification in
                        NotificationRow(notification: notification)
                            .onTapGesture {
                                if !notification.isRead {
                                    notificationManager.markAsRead(notification.id)
                                }
                            }
                            .listRowBackground(
                                notification.isRead
                                    ? Color.app.background
                                    : Color.app.accent.opacity(0.05)
                            )
                            .listRowInsets(EdgeInsets(
                                top: CGFloat.sm,
                                leading: CGFloat.lg,
                                bottom: CGFloat.sm,
                                trailing: CGFloat.lg
                            ))
                    }
                }
                .listStyle(.plain)
                .refreshable {
                    await notificationManager.fetchHistory()
                }
            }
        }
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: Spacing.lg.rawValue) {
            Image(systemName: "bell.slash")
                .font(.system(size: 48))
                .foregroundStyle(Color.app.textTertiary)

            Text("Sin notificaciones")
                .font(.app(.headline))
                .foregroundStyle(Color.app.textSecondary)

            Text("Las notificaciones aparecerán aquí")
                .font(.app(.subheadline))
                .foregroundStyle(Color.app.textTertiary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Notification Row

private struct NotificationRow: View {
    let notification: AppNotification

    var body: some View {
        HStack(alignment: .top, spacing: CGFloat.md) {
            // Type icon
            Image(systemName: notification.notificationType.icon)
                .font(.system(size: 18))
                .foregroundStyle(notification.notificationType.toastType.color)
                .frame(width: 32, height: 32)
                .background(
                    notification.notificationType.toastType.backgroundColor,
                    in: RoundedRectangle(cornerRadius: Radius.sm.rawValue)
                )

            VStack(alignment: .leading, spacing: 4) {
                Text(notification.message)
                    .font(.app(.subheadline))
                    .foregroundStyle(Color.app.textPrimary)
                    .fontWeight(notification.isRead ? .regular : .medium)

                HStack(spacing: CGFloat.sm) {
                    if let amount = notification.amount {
                        Text(amount.currencyFormatted)
                            .font(.app(.caption))
                            .foregroundStyle(Color.app.accent)
                    }

                    Text(notification.createdAt.timeAgoFormatted)
                        .font(.app(.caption))
                        .foregroundStyle(Color.app.textTertiary)
                }
            }

            Spacer()

            if !notification.isRead {
                Circle()
                    .fill(Color.app.accent)
                    .frame(width: 8, height: 8)
                    .padding(.top, 6)
            }
        }
        .padding(.vertical, 4)
    }
}
