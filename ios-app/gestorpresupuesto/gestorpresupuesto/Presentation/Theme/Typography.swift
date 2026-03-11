import SwiftUI
import UIKit

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

    var font: Font {
        switch self {
        case .largeTitle: return .system(size: 34, weight: .bold, design: .rounded)
        case .title: return .system(size: 28, weight: .bold, design: .rounded)
        case .title2: return .system(size: 22, weight: .semibold, design: .rounded)
        case .title3: return .system(size: 20, weight: .semibold, design: .rounded)
        case .headline: return .system(size: 17, weight: .semibold, design: .rounded)
        case .body: return .system(size: 17, weight: .regular, design: .rounded)
        case .callout: return .system(size: 16, weight: .regular, design: .rounded)
        case .subheadline: return .system(size: 15, weight: .regular, design: .rounded)
        case .footnote: return .system(size: 13, weight: .regular, design: .rounded)
        case .caption: return .system(size: 12, weight: .regular, design: .rounded)
        case .caption2: return .system(size: 11, weight: .regular, design: .rounded)
        }
    }

    var uiFont: UIFont {
        switch self {
        case .largeTitle: return .systemFont(ofSize: 34, weight: .bold)
        case .title: return .systemFont(ofSize: 28, weight: .bold)
        case .title2: return .systemFont(ofSize: 22, weight: .semibold)
        case .title3: return .systemFont(ofSize: 20, weight: .semibold)
        case .headline: return .systemFont(ofSize: 17, weight: .semibold)
        case .body: return .systemFont(ofSize: 17, weight: .regular)
        case .callout: return .systemFont(ofSize: 16, weight: .regular)
        case .subheadline: return .systemFont(ofSize: 15, weight: .regular)
        case .footnote: return .systemFont(ofSize: 13, weight: .regular)
        case .caption: return .systemFont(ofSize: 12, weight: .regular)
        case .caption2: return .systemFont(ofSize: 11, weight: .regular)
        }
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
