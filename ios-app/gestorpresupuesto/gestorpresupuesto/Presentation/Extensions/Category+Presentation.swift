import SwiftUI

extension Category {
    var colorValue: Color {
        Color.fromHex(color) ?? .gray
    }
}
