import SwiftUI

struct DatePickerField: View {
    let title: String
    @Binding var date: Date
    var displayedComponents: DatePicker<Text>.Components = .date

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.xs.rawValue) {
            Text(title)
                .font(.app(.caption))
                .foregroundStyle(Color.app.textSecondary)

            DatePicker("", selection: $date, displayedComponents: displayedComponents)
                .datePickerStyle(.compact)
                .labelsHidden()
                .tint(Color.app.accent)
                .padding(.horizontal, Spacing.md.rawValue)
                .padding(.vertical, Spacing.xs.rawValue)
                .background(Color.app.surface)
                .clipShape(RoundedRectangle(cornerRadius: Radius.md.rawValue))
                .overlay(
                    RoundedRectangle(cornerRadius: Radius.md.rawValue)
                        .stroke(Color.app.border, lineWidth: 1)
                )
        }
    }
}
