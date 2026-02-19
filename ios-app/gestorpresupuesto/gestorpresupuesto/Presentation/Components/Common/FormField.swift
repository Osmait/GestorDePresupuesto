import SwiftUI

enum FieldValidationState {
    case normal
    case focused
    case valid
    case invalid
    
    var borderColor: Color {
        switch self {
        case .normal: return Color.app.border
        case .focused: return Color.app.accent
        case .valid: return Color.app.success
        case .invalid: return Color.app.error
        }
    }
}

struct FormField: View {
    let icon: String
    let placeholder: String
    @Binding var text: String
    var keyboardType: UIKeyboardType = .default
    var autocapitalization: TextInputAutocapitalization = .sentences
    var isSecure: Bool = false
    var validation: ((String) -> String?)?
    var showSuccessIndicator: Bool = true
    
    @FocusState private var isFocused: Bool
    @State private var errorMessage: String?
    @State private var hasBeenEdited: Bool = false
    
    private var validationState: FieldValidationState {
        if isFocused {
            if let error = errorMessage, hasBeenEdited {
                return .invalid
            }
            return .focused
        }
        
        if let error = errorMessage, hasBeenEdited {
            return .invalid
        }
        
        if showSuccessIndicator, hasBeenEdited, errorMessage == nil, !text.isEmpty {
            return .valid
        }
        
        return .normal
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: .xs) {
            HStack(spacing: .sm) {
                Image(systemName: icon)
                    .font(.system(size: 16))
                    .foregroundStyle(validationState == .focused ? Color.app.accent : Color.app.textTertiary)
                    .frame(width: 20)
                
                if isSecure {
                    SecureField(placeholder, text: $text)
                        .font(.app(.body))
                        .focused($isFocused)
                        .textInputAutocapitalization(autocapitalization)
                } else {
                    TextField(placeholder, text: $text)
                        .font(.app(.body))
                        .keyboardType(keyboardType)
                        .focused($isFocused)
                        .textInputAutocapitalization(autocapitalization)
                }
                
                if validationState == .valid {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 16))
                        .foregroundStyle(Color.app.success)
                        .transition(.scale.combined(with: .opacity))
                }
                
                if validationState == .invalid {
                    Image(systemName: "exclamationmark.circle.fill")
                        .font(.system(size: 16))
                        .foregroundStyle(Color.app.error)
                        .transition(.scale.combined(with: .opacity))
                }
            }
            .padding()
            .background(Color.app.surfaceSecondary)
            .cornerRadius(.md)
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md.rawValue)
                    .stroke(validationState.borderColor, lineWidth: isFocused ? 2 : 1)
            )
            .animation(.easeInOut(duration: 0.2), value: validationState)
            
            if let error = errorMessage, hasBeenEdited {
                HStack(spacing: .xs) {
                    Image(systemName: "exclamationmark.circle")
                        .font(.caption2)
                    Text(error)
                        .font(.caption)
                }
                .foregroundStyle(Color.app.error)
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .onChange(of: text) { newValue in
            hasBeenEdited = true
            validate(newValue)
        }
        .onChange(of: isFocused) { focused in
            if focused {
                hasBeenEdited = true
            } else if !text.isEmpty {
                validate(text)
            }
        }
    }
    
    private func validate(_ value: String) {
        if let validation = validation {
            errorMessage = validation(value)
        }
    }
}

#Preview {
    ZStack {
        Color.app.background.ignoresSafeArea()
        
        VStack(spacing: 24) {
            FormField(
                icon: "envelope",
                placeholder: "Email",
                text: .constant("test@email.com"),
                keyboardType: .emailAddress,
                autocapitalization: .never,
                validation: { value in
                    value.isEmpty ? "El email es requerido" : nil
                }
            )
            
            FormField(
                icon: "lock",
                placeholder: "Contraseña",
                text: .constant("password"),
                isSecure: true,
                validation: { value in
                    value.count < 8 ? "Mínimo 8 caracteres" : nil
                }
            )
        }
        .padding()
    }
}
