import SwiftUI

enum Spacing: CGFloat {
    case xxs = 2
    case xs = 4
    case sm = 8
    case md = 12
    case lg = 16
    case xl = 24
    case xxl = 32
    case xxxl = 48
}

enum Radius: CGFloat {
    case sm = 6
    case md = 8
    case lg = 12
    case xl = 16
    case xxl = 24
    case full = 999
}

enum Elevation: CGFloat {
    case none = 0
    case sm = 2
    case md = 4
    case lg = 8
    case xl = 16
}

extension CGFloat {
    static var xxs: CGFloat { Spacing.xxs.rawValue }
    static var xs: CGFloat { Spacing.xs.rawValue }
    static var sm: CGFloat { Spacing.sm.rawValue }
    static var md: CGFloat { Spacing.md.rawValue }
    static var lg: CGFloat { Spacing.lg.rawValue }
    static var xl: CGFloat { Spacing.xl.rawValue }
    static var xxl: CGFloat { Spacing.xxl.rawValue }
    static var xxxl: CGFloat { Spacing.xxxl.rawValue }
    
    static func spacing(_ spacing: Spacing) -> CGFloat {
        spacing.rawValue
    }
    
    static func radius(_ radius: Radius) -> CGFloat {
        radius.rawValue
    }
}

extension Spacing {
    var cgFloat: CGFloat { rawValue }
}

extension Radius {
    var cgFloat: CGFloat { rawValue }
}

extension View {
    func padding(_ spacing: Spacing) -> some View {
        self.padding(spacing.rawValue)
    }
    
    func padding(_ edges: Edge.Set, _ spacing: Spacing) -> some View {
        self.padding(edges, spacing.rawValue)
    }
    
    func cornerRadius(_ radius: Radius) -> some View {
        self.cornerRadius(radius.rawValue)
    }
    
    func glassBackground(cornerRadius: Radius = .lg, opacity: Double = 0.8) -> some View {
        self
            .background(
                RoundedRectangle(cornerRadius: cornerRadius.rawValue)
                    .fill(.ultraThinMaterial)
                    .opacity(opacity)
            )
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius.rawValue)
                    .stroke(Color.app.border, lineWidth: 0.5)
            )
    }
    
    func cardShadow(elevation: Elevation = .md) -> some View {
        self.shadow(color: Color.black.opacity(0.08), radius: elevation.rawValue, x: 0, y: elevation.rawValue / 2)
    }
    
    func gradientOverlay(colors: [Color], startPoint: UnitPoint = .topLeading, endPoint: UnitPoint = .bottomTrailing) -> some View {
        self.overlay(
            LinearGradient(colors: colors, startPoint: startPoint, endPoint: endPoint)
        )
    }
    
    func gradientBackground(colors: [Color], cornerRadius: Radius = .lg) -> some View {
        self.background(
            LinearGradient(colors: colors, startPoint: .topLeading, endPoint: .bottomTrailing)
                .cornerRadius(cornerRadius.rawValue)
        )
    }
}
