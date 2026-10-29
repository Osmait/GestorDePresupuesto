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
                    .fill(Color.app.surface)
            )
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius.rawValue)
                    .strokeBorder(hasBorder ? Color.app.border : Color.clear, lineWidth: 1)
            )
    }
}

/// Kept for API compatibility: renders as a flat card. `colors` no longer
/// paint the background (no gradient tiles, see DESIGN.md).
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
                    .fill(Color.app.surface)
            )
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius.rawValue)
                    .strokeBorder(Color.app.border, lineWidth: 1)
            )
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
                    .strokeBorder(Color.app.border, lineWidth: 1)
            )
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
                    .foregroundStyle(Color.app.textPrimary)
            }

            SurfaceCard {
                Text("Surface Card")
                    .foregroundStyle(Color.app.textPrimary)
            }
        }
        .padding()
    }
}
