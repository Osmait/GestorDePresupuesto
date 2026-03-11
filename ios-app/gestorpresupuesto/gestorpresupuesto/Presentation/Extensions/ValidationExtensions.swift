import Foundation

extension String {
    var isValidEmail: Bool {
        let emailRegex = "[A-Z0-9a-z._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,64}"
        let emailPredicate = NSPredicate(format: "SELF MATCHES %@", emailRegex)
        return emailPredicate.evaluate(with: self)
    }

    var isValidPassword: Bool {
        let hasMinLength = self.count >= 8
        let hasUppercase = self.contains { $0.isUppercase }
        let hasLowercase = self.contains { $0.isLowercase }
        let hasNumber = self.contains { $0.isNumber }

        return hasMinLength && hasUppercase && hasLowercase && hasNumber
    }

    var passwordStrength: PasswordStrength {
        var score = 0

        if self.count >= 8 { score += 1 }
        if self.count >= 12 { score += 1 }
        if self.contains(where: { $0.isUppercase }) { score += 1 }
        if self.contains(where: { $0.isLowercase }) { score += 1 }
        if self.contains(where: { $0.isNumber }) { score += 1 }
        if self.contains(where: { "!@#$%^&*()_+-=[]{}|;':\",./<>?".contains($0) }) { score += 1 }

        switch score {
        case 0...2: return .weak
        case 3...4: return .medium
        default: return .strong
        }
    }

    var isValidAmount: Bool {
        guard let value = Double(self) else { return false }
        return value > 0
    }

    var isNotEmpty: Bool {
        !self.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var isValidName: Bool {
        let trimmed = self.trimmingCharacters(in: .whitespacesAndNewlines)
        return !trimmed.isEmpty && trimmed.count >= 2
    }

    var emailError: String? {
        if self.isEmpty { return "El email es requerido" }
        if !isValidEmail { return "Ingresa un email válido" }
        return nil
    }

    var passwordError: String? {
        if self.isEmpty { return "La contraseña es requerida" }
        if self.count < 8 { return "Mínimo 8 caracteres" }
        if !self.contains(where: { $0.isUppercase }) { return "Debe contener al menos una mayúscula" }
        if !self.contains(where: { $0.isNumber }) { return "Debe contener al menos un número" }
        return nil
    }

    var nameError: String? {
        if self.isEmpty { return "Este campo es requerido" }
        if self.count < 2 { return "Mínimo 2 caracteres" }
        return nil
    }

    var amountError: String? {
        if self.isEmpty { return "El monto es requerido" }
        if !isValidAmount { return "Ingresa un monto válido mayor a 0" }
        return nil
    }
}

extension Double {
    var isValidAmount: Bool {
        self > 0
    }
}
