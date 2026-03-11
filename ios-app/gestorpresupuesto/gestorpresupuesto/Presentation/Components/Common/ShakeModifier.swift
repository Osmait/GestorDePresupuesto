import SwiftUI

struct ShakeModifier: ViewModifier {
    let trigger: Bool
    let amount: CGFloat
    let shakesCount: Int

    init(trigger: Bool, amount: CGFloat = 10, shakesCount: Int = 3) {
        self.trigger = trigger
        self.amount = amount
        self.shakesCount = shakesCount
    }

    func body(content: Content) -> some View {
        content
            .offset(x: trigger ? amount : 0)
            .animation(
                trigger
                    ? Animation.default.repeatCount(shakesCount * 2, autoreverses: true).speed(6)
                    : .default,
                value: trigger
            )
    }
}

extension View {
    func shake(trigger: Bool, amount: CGFloat = 10, shakesCount: Int = 3) -> some View {
        self.modifier(ShakeModifier(trigger: trigger, amount: amount, shakesCount: shakesCount))
    }
}

#Preview {
    struct ShakePreview: View {
        @State private var shake = false

        var body: some View {
            VStack(spacing: 40) {
                Text("Shake Demo")
                    .font(.title)
                    .padding()
                    .background(Color.app.surfaceSecondary)
                    .cornerRadius(.md)
                    .shake(trigger: shake)

                Button("Shake!") {
                    shake = false
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                        shake = true
                    }
                }
                .buttonStyle(.borderedProminent)
            }
        }
    }

    return ShakePreview()
}
