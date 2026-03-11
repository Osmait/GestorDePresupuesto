import SwiftUI

struct GlassCard<Content: View>: View {
    let content: Content
    var cornerRadius: Radius = .lg
    var padding: Spacing = .lg
    var hasBorder: Bool = true

    init(
        cornerRadius: Radius = .lg,
        padding: Spacing = .lg,
        hasBorder: Bool = true,
        @ViewBuilder content: () -> Content
    ) {
        self.cornerRadius = cornerRadius
        self.padding = padding
        self.hasBorder = hasBorder
        self.content = content()
    }

    var body: some View {
        content
            .padding(padding)
            .background(
                RoundedRectangle(cornerRadius: cornerRadius.rawValue)
                    .fill(.ultraThinMaterial)
            )
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius.rawValue)
                    .stroke(
                        hasBorder ? Color.primary.opacity(0.1) : Color.clear,
                        lineWidth: 0.5
                    )
            )
            .cardShadow()
    }
}

struct GradientCard<Content: View>: View {
    let colors: [Color]
    let content: Content
    var cornerRadius: Radius = .lg
    var padding: Spacing = .lg

    init(
        colors: [Color],
        cornerRadius: Radius = .lg,
        padding: Spacing = .lg,
        @ViewBuilder content: () -> Content
    ) {
        self.colors = colors
        self.cornerRadius = cornerRadius
        self.padding = padding
        self.content = content()
    }

    var body: some View {
        content
            .padding(padding)
            .background(
                RoundedRectangle(cornerRadius: cornerRadius.rawValue)
                    .fill(
                        LinearGradient(
                            colors: colors,
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
            )
            .cardShadow(elevation: .lg)
    }
}

struct SurfaceCard<Content: View>: View {
    let content: Content
    var cornerRadius: Radius = .lg
    var padding: Spacing = .lg

    init(
        cornerRadius: Radius = .lg,
        padding: Spacing = .lg,
        @ViewBuilder content: () -> Content
    ) {
        self.cornerRadius = cornerRadius
        self.padding = padding
        self.content = content()
    }

    var body: some View {
        content
            .padding(padding)
            .background(Color.app.surface)
            .cornerRadius(cornerRadius)
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius.rawValue)
                    .stroke(Color.app.border, lineWidth: 0.5)
            )
            .cardShadow()
    }
}

#Preview {
    ZStack {
        Color.app.background.ignoresSafeArea()

        VStack(spacing: 20) {
            GlassCard {
                Text("Glass Card")
                    .foregroundStyle(Color.app.textPrimary)
            }

            GradientCard(colors: Color.app.gradientPrimary) {
                Text("Gradient Card")
                    .foregroundStyle(.white)
            }

            SurfaceCard {
                Text("Surface Card")
                    .foregroundStyle(Color.app.textPrimary)
            }
        }
        .padding()
    }
}
