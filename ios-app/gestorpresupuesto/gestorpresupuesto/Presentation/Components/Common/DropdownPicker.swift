import SwiftUI

struct DropdownPicker<T: Hashable>: View {
    let title: String
    @Binding var selection: T
    let options: [T]
    let labelForOption: (T) -> String
    var icon: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.xs.rawValue) {
            Text(title)
                .font(.app(.caption))
                .foregroundStyle(Color.app.textSecondary)

            Menu {
                ForEach(options, id: \.self) { option in
                    Button(labelForOption(option)) {
                        selection = option
                        HapticManager.shared.selection()
                    }
                }
            } label: {
                HStack {
                    if let icon = icon {
                        Image(systemName: icon)
                            .foregroundStyle(Color.app.accent)
                    }
                    Text(labelForOption(selection))
                        .font(.app(.body))
                        .foregroundStyle(Color.app.textPrimary)
                    Spacer()
                    Image(systemName: "chevron.down")
                        .font(.caption)
                        .foregroundStyle(Color.app.textTertiary)
                }
                .padding(.horizontal, Spacing.md.rawValue)
                .padding(.vertical, Spacing.sm.rawValue)
                .background(Color.app.surface)
                .clipShape(RoundedRectangle(cornerRadius: Radius.md.rawValue))
                .overlay(
                    RoundedRectangle(cornerRadius: Radius.md.rawValue)
                        .stroke(Color.app.border, lineWidth: 1)
                )
            }
        }
    }
}
