import SwiftUI
import UIKit

extension View {
    /// Applied to sheet content: a "Listo" key above the keyboard (number pads
    /// have no return key), dragging the form dismisses the keyboard, and on
    /// iPad the sheet takes the form size instead of stretching.
    func formSheet() -> some View {
        self
            .scrollDismissesKeyboard(.interactively)
            .toolbar {
                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    Button("Listo") {
                        UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
                    }
                }
            }
            .presentationSizing(.form)
    }
}
