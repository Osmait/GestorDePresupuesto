import SwiftUI

enum PasswordStrength {
    case weak
    case medium
    case strong

    var color: Color {
        switch self {
        case .weak: return .app.error
        case .medium: return .app.warning
        case .strong: return .app.success
        }
    }

    var label: String {
        switch self {
        case .weak: return "Débil"
        case .medium: return "Media"
        case .strong: return "Fuerte"
        }
    }

    var segmentCount: Int {
        switch self {
        case .weak: return 1
        case .medium: return 2
        case .strong: return 3
        }
    }
}

struct PasswordStrengthIndicator: View {
    let strength: PasswordStrength
    let isVisible: Bool

    @State private var animatedSegments: Int = 0

    var body: some View {
        VStack(alignment: .leading, spacing: .xs) {
            HStack(spacing: .xs) {
                ForEach(0..<3, id: \.self) { index in
                    RoundedRectangle(cornerRadius: 2)
                        .fill(index < animatedSegments ? strength.color : Color.app.surfaceSecondary)
                        .frame(height: 4)
                        .animation(.spring(response: 0.3, dampingFraction: 0.7), value: animatedSegments)
                }
            }

            if isVisible {
                Text(strength.label)
                    .font(.caption2)
                    .foregroundStyle(strength.color)
                    .transition(.opacity)
            }
        }
        .onChange(of: strength) { newStrength in
            withAnimation {
                animatedSegments = newStrength.segmentCount
            }
        }
        .onAppear {
            animatedSegments = strength.segmentCount
        }
    }
}

#Preview {
    ZStack {
        Color.app.background.ignoresSafeArea()

        VStack(spacing: 24) {
            PasswordStrengthIndicator(strength: .weak, isVisible: true)
            PasswordStrengthIndicator(strength: .medium, isVisible: true)
            PasswordStrengthIndicator(strength: .strong, isVisible: true)
        }
        .padding()
    }
}
