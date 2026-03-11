import SwiftUI
import Combine

struct LoginView: View {
    @ObservedObject var viewModel: AuthViewModel
    @State private var email = ""
    @State private var password = ""
    @State private var showingRegister = false

    @State private var animationPhase: AnimationPhase = .initial
    @State private var shakeTrigger = false

    enum AnimationPhase {
        case initial, logoAppearing, titleAppearing, cardAppearing, complete
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.app.background.ignoresSafeArea()

                VStack(spacing: 0) {
                    Spacer()

                    VStack(spacing: .lg) {
                        logoView
                        titleView
                    }
                    .padding(.bottom, .xxl)

                    cardView
                        .padding(.horizontal, .xl)

                    Spacer()
                    Spacer()
                }
                .errorBanner(isPresented: $viewModel.showErrorBanner, message: viewModel.errorBannerMessage)
                .toast(isPresented: $viewModel.showToast, type: viewModel.toastType, message: viewModel.toastMessage)
            }
            .sheet(isPresented: $showingRegister) {
                RegisterView(viewModel: viewModel, isPresented: $showingRegister)
            }
            .onAppear {
                startEntranceAnimation()
            }
        }
    }

    private var logoView: some View {
        ZStack {
            Circle()
                .fill(
                    LinearGradient(
                        colors: Color.app.gradientPrimary,
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: 80, height: 80)
                .shadow(color: Color.app.accent.opacity(0.3), radius: 20, x: 0, y: 10)

            Image(systemName: "wallet.fill")
                .font(.system(size: 36))
                .foregroundStyle(.white)
        }
        .scaleEffect(animationPhase == .initial ? 0.5 : 1.0)
        .opacity(animationPhase == .initial ? 0 : 1)
        .animation(.spring(response: 0.6, dampingFraction: 0.7), value: animationPhase)
    }

    private var titleView: some View {
        VStack(spacing: .xs) {
            Text("Gestor de Presupuesto")
                .font(.app(.title))
                .foregroundStyle(Color.app.textPrimary)

            Text("Controla tus finanzas personales")
                .font(.app(.subheadline))
                .foregroundStyle(Color.app.textSecondary)
        }
        .opacity(animationPhase == .initial || animationPhase == .logoAppearing ? 0 : 1)
        .offset(y: animationPhase == .initial || animationPhase == .logoAppearing ? -20 : 0)
        .animation(.spring(response: 0.5, dampingFraction: 0.8).delay(0.1), value: animationPhase)
    }

    private var cardView: some View {
        GlassCard(cornerRadius: .xl, padding: .xl) {
            VStack(spacing: .lg) {
                VStack(spacing: .md) {
                    FormField(
                        icon: "envelope",
                        placeholder: "Email",
                        text: $email,
                        keyboardType: .emailAddress,
                        autocapitalization: .never,
                        validation: { $0.emailError }
                    )

                    FormField(
                        icon: "lock",
                        placeholder: "Contraseña",
                        text: $password,
                        isSecure: true,
                        showSuccessIndicator: false
                    )
                }

                PrimaryButton(
                    "Iniciar Sesión",
                    icon: "arrow.right",
                    isLoading: viewModel.isLoading
                ) {
                    Task {
                        await viewModel.login(email: email, password: password)

                        if viewModel.error != nil {
                            triggerShake()
                        }
                    }
                }
                .disabled(email.isEmpty || password.isEmpty)

                Button {
                    showingRegister = true
                } label: {
                    Text("¿No tienes cuenta? ")
                        .foregroundStyle(Color.app.textSecondary)
                    + Text("Regístrate")
                        .fontWeight(.semibold)
                        .foregroundStyle(Color.app.accent)
                }
            }
        }
        .shake(trigger: shakeTrigger)
        .opacity(animationPhase == .initial || animationPhase == .logoAppearing || animationPhase == .titleAppearing ? 0 : 1)
        .offset(y: animationPhase == .initial || animationPhase == .logoAppearing || animationPhase == .titleAppearing ? 50 : 0)
        .animation(.spring(response: 0.6, dampingFraction: 0.8).delay(0.2), value: animationPhase)
    }

    private func startEntranceAnimation() {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            animationPhase = .logoAppearing
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            animationPhase = .titleAppearing
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            animationPhase = .cardAppearing
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
            animationPhase = .complete
        }
    }

    private func triggerShake() {
        shakeTrigger = false
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
            shakeTrigger = true
        }
    }
}

struct RegisterView: View {
    @ObservedObject var viewModel: AuthViewModel
    @Binding var isPresented: Bool

    @State private var name = ""
    @State private var lastName = ""
    @State private var email = ""
    @State private var password = ""
    @State private var confirmPassword = ""
    @State private var shakeTrigger = false

    private var passwordsMatch: Bool {
        password == confirmPassword
    }

    private var isValidForm: Bool {
        name.isValidName &&
        lastName.isValidName &&
        email.isValidEmail &&
        password.isValidPassword &&
        passwordsMatch
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.app.background.ignoresSafeArea()

                ScrollView {
                    GlassCard(cornerRadius: .xl, padding: .lg) {
                        VStack(spacing: .lg) {
                            Text("Crear Cuenta")
                                .font(.app(.title3))
                                .foregroundStyle(Color.app.textPrimary)

                            VStack(spacing: .md) {
                                FormField(
                                    icon: "person",
                                    placeholder: "Nombre",
                                    text: $name,
                                    validation: { $0.nameError }
                                )

                                FormField(
                                    icon: "person",
                                    placeholder: "Apellido",
                                    text: $lastName,
                                    validation: { $0.nameError }
                                )

                                FormField(
                                    icon: "envelope",
                                    placeholder: "Email",
                                    text: $email,
                                    keyboardType: .emailAddress,
                                    autocapitalization: .never,
                                    validation: { $0.emailError }
                                )

                                VStack(spacing: .xs) {
                                    FormField(
                                        icon: "lock",
                                        placeholder: "Contraseña",
                                        text: $password,
                                        isSecure: true,
                                        showSuccessIndicator: false
                                    )

                                    if !password.isEmpty {
                                        PasswordStrengthIndicator(
                                            strength: password.passwordStrength,
                                            isVisible: true
                                        )
                                    }
                                }

                                VStack(spacing: .xs) {
                                    FormField(
                                        icon: "lock",
                                        placeholder: "Confirmar contraseña",
                                        text: $confirmPassword,
                                        isSecure: true,
                                        validation: { value in
                                            if value.isEmpty { return nil }
                                            if !passwordsMatch { return "Las contraseñas no coinciden" }
                                            return nil
                                        }
                                    )

                                    if !confirmPassword.isEmpty && passwordsMatch {
                                        HStack(spacing: .xs) {
                                            Image(systemName: "checkmark.circle.fill")
                                                .foregroundStyle(Color.app.success)
                                            Text("Las contraseñas coinciden")
                                                .font(.caption)
                                                .foregroundStyle(Color.app.success)
                                        }
                                        .transition(.opacity)
                                    }
                                }
                            }

                            HStack(spacing: .md) {
                                SecondaryButton("Cancelar") {
                                    isPresented = false
                                }

                                PrimaryButton(
                                    "Registrar",
                                    isLoading: viewModel.isLoading
                                ) {
                                    Task {
                                        await viewModel.register(name: name, lastName: lastName, email: email, password: password)
                                        if viewModel.isAuthenticated {
                                            isPresented = false
                                        } else if viewModel.error != nil {
                                            triggerShake()
                                        }
                                    }
                                }
                                .disabled(!isValidForm)
                            }
                        }
                    }
                    .padding()
                    .shake(trigger: shakeTrigger)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cerrar") {
                        isPresented = false
                    }
                }
            }
            .toast(isPresented: $viewModel.showToast, type: viewModel.toastType, message: viewModel.toastMessage)
        }
    }

    private func triggerShake() {
        shakeTrigger = false
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
            shakeTrigger = true
        }
    }
}

#Preview {
    LoginView(viewModel: AuthViewModel())
}
