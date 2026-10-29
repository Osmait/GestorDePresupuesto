import SwiftUI

enum ReadableWidth {
    /// Lists and forms: comfortable line length on iPad.
    static let standard: CGFloat = 760
    /// Two-column screens (Inicio, Plan) on iPad.
    static let wide: CGFloat = 1100
}

extension View {
    /// Caps the content width and centers it, keeping the app background
    /// edge to edge. No effect on iPhone, where the screen is narrower.
    func readableWidth(_ maxWidth: CGFloat = ReadableWidth.standard) -> some View {
        frame(maxWidth: maxWidth)
            .frame(maxWidth: .infinity)
            .background(Color.app.background.ignoresSafeArea())
    }
}
