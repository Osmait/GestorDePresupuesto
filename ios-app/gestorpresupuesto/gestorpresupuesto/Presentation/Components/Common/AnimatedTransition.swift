import SwiftUI

// MARK: - Staggered List Animation

struct StaggeredAppearance: ViewModifier {
    let index: Int
    let delay: Double
    @State private var isVisible = false

    func body(content: Content) -> some View {
        content
            .opacity(isVisible ? 1 : 0)
            .offset(y: isVisible ? 0 : 20)
            .onAppear {
                withAnimation(.spring(response: 0.4, dampingFraction: 0.8).delay(Double(index) * delay)) {
                    isVisible = true
                }
            }
    }
}

extension View {
    func staggeredAppearance(index: Int, delay: Double = 0.05) -> some View {
        modifier(StaggeredAppearance(index: index, delay: delay))
    }
}

// MARK: - Animated Number Counter

struct AnimatedNumberText: View {
    let value: Double
    let format: (Double) -> String
    @State private var displayedValue: Double = 0

    init(_ value: Double, format: @escaping (Double) -> String = { $0.currencyFormatted }) {
        self.value = value
        self.format = format
    }

    var body: some View {
        Text(format(displayedValue))
            .onAppear {
                withAnimation(.easeOut(duration: 0.8)) {
                    displayedValue = value
                }
            }
            .onChange(of: value) { _, newValue in
                withAnimation(.easeOut(duration: 0.5)) {
                    displayedValue = newValue
                }
            }
    }
}

// MARK: - Pulse Animation

struct PulseModifier: ViewModifier {
    @State private var isPulsing = false

    func body(content: Content) -> some View {
        content
            .scaleEffect(isPulsing ? 1.05 : 1.0)
            .opacity(isPulsing ? 0.8 : 1.0)
            .onAppear {
                withAnimation(.easeInOut(duration: 1.2).repeatForever(autoreverses: true)) {
                    isPulsing = true
                }
            }
    }
}

extension View {
    func pulse() -> some View {
        modifier(PulseModifier())
    }
}

// MARK: - Slide In

struct SlideInModifier: ViewModifier {
    let edge: Edge
    @State private var isVisible = false

    func body(content: Content) -> some View {
        content
            .opacity(isVisible ? 1 : 0)
            .offset(
                x: isVisible ? 0 : (edge == .leading ? -50 : edge == .trailing ? 50 : 0),
                y: isVisible ? 0 : (edge == .top ? -50 : edge == .bottom ? 50 : 0)
            )
            .onAppear {
                withAnimation(.spring(response: 0.5, dampingFraction: 0.7)) {
                    isVisible = true
                }
            }
    }
}

extension View {
    func slideIn(from edge: Edge = .bottom) -> some View {
        modifier(SlideInModifier(edge: edge))
    }
}
