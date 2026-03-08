import SwiftUI

struct ConfirmationDialog: ViewModifier {
    @Binding var isPresented: Bool
    let title: String
    let message: String
    let confirmTitle: String
    let confirmRole: ButtonRole?
    let onConfirm: () -> Void

    init(
        isPresented: Binding<Bool>,
        title: String,
        message: String,
        confirmTitle: String = "Eliminar",
        confirmRole: ButtonRole? = .destructive,
        onConfirm: @escaping () -> Void
    ) {
        self._isPresented = isPresented
        self.title = title
        self.message = message
        self.confirmTitle = confirmTitle
        self.confirmRole = confirmRole
        self.onConfirm = onConfirm
    }

    func body(content: Content) -> some View {
        content
            .alert(title, isPresented: $isPresented) {
                Button("Cancelar", role: .cancel) {}
                Button(confirmTitle, role: confirmRole) {
                    HapticManager.shared.impact(.medium)
                    onConfirm()
                }
            } message: {
                Text(message)
            }
    }
}

extension View {
    func deleteConfirmation(
        isPresented: Binding<Bool>,
        itemName: String,
        onConfirm: @escaping () -> Void
    ) -> some View {
        modifier(ConfirmationDialog(
            isPresented: isPresented,
            title: "Eliminar \(itemName)",
            message: "¿Estás seguro de que deseas eliminar este elemento? Esta acción no se puede deshacer.",
            onConfirm: onConfirm
        ))
    }

    func confirmAction(
        isPresented: Binding<Bool>,
        title: String,
        message: String,
        confirmTitle: String = "Confirmar",
        onConfirm: @escaping () -> Void
    ) -> some View {
        modifier(ConfirmationDialog(
            isPresented: isPresented,
            title: title,
            message: message,
            confirmTitle: confirmTitle,
            confirmRole: nil,
            onConfirm: onConfirm
        ))
    }
}
