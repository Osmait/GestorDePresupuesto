import SwiftUI

struct BiometricEnrollmentAlert: ViewModifier {
    @Binding var isPresented: Bool
    let biometricType: BiometricType
    let onEnable: () -> Void
    let onSkip: () -> Void

    private var title: String {
        switch biometricType {
        case .faceID:
            return "Activar Face ID?"
        case .touchID:
            return "Activar Touch ID?"
        case .none:
            return ""
        }
    }

    private var message: String {
        switch biometricType {
        case .faceID:
            return "Usa Face ID para desbloquear la app de forma rápida y segura."
        case .touchID:
            return "Usa Touch ID para desbloquear la app de forma rápida y segura."
        case .none:
            return ""
        }
    }

    func body(content: Content) -> some View {
        content
            .alert(title, isPresented: $isPresented) {
                Button("Activar") {
                    onEnable()
                }
                Button("Ahora no", role: .cancel) {
                    onSkip()
                }
            } message: {
                Text(message)
            }
    }
}

extension View {
    func biometricEnrollmentAlert(
        isPresented: Binding<Bool>,
        biometricType: BiometricType,
        onEnable: @escaping () -> Void,
        onSkip: @escaping () -> Void
    ) -> some View {
        modifier(BiometricEnrollmentAlert(
            isPresented: isPresented,
            biometricType: biometricType,
            onEnable: onEnable,
            onSkip: onSkip
        ))
    }
}
