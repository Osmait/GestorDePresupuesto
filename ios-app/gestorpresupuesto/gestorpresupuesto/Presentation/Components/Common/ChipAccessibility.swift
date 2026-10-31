import SwiftUI

extension View {
    /// For chips and segment-like buttons: a 44 pt tall hit area (the drawn
    /// chip keeps its size) and the selected state announced by VoiceOver.
    func chipAccessibility(selected: Bool) -> some View {
        self
            .frame(minHeight: 44)
            .contentShape(Rectangle())
            .accessibilityAddTraits(selected ? .isSelected : [])
    }
}
