import SwiftUI

enum AppFont {
    case largeTitle
    case title
    case title2
    case title3
    case headline
    case body
    case callout
    case subheadline
    case footnote
    case caption
    case caption2

    /// The system text style each role scales with (Dynamic Type).
    var textStyle: Font.TextStyle {
        switch self {
        case .largeTitle: return .largeTitle
        case .title: return .title
        case .title2: return .title2
        case .title3: return .title3
        case .headline: return .headline
        case .body: return .body
        case .callout: return .callout
        case .subheadline: return .subheadline
        case .footnote: return .footnote
        case .caption: return .caption
        case .caption2: return .caption2
        }
    }

    var weight: Font.Weight {
        switch self {
        case .largeTitle, .title: return .bold
        case .title2, .title3, .headline: return .semibold
        default: return .regular
        }
    }

    /// Same sizes as before at the default text size (largeTitle 34, body 17,
    /// caption2 11), now following the user's text size.
    var font: Font {
        .system(textStyle, weight: weight)
    }
}

extension Font {
    /// Hero amounts (balances, the amount being typed): large title size,
    /// tabular figures so digits do not jump as they change.
    static var appAmount: Font {
        .system(.largeTitle, weight: .bold).monospacedDigit()
    }
}

extension Text {
    func font(_ style: AppFont) -> Text {
        self.font(style.font)
    }
}

extension Font {
    static func app(_ style: AppFont) -> Font {
        style.font
    }
}
