import SwiftUI

struct BiometricLockView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @ObservedObject var viewModel: AuthViewModel
    @State private var animationPhase: AnimationPhase = .initial
    @State private var isAuthenticating = false

    enum AnimationPhase {
        case initial, logoAppearing, contentAppearing, complete
    }

    private var biometricIconName: String {
        viewModel.biometricType == .faceID ? "faceid" : "touchid"
    }

    private var biometricLabel: String {
        viewModel.biometricType == .faceID ? "Desbloquear con Face ID" : "Desbloquear con Touch ID"
    }

    var body: some View {
        ZStack {
            Color.app.background.ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer()

                VStack(spacing: .lg) {
                    logoView
                    greetingView
                }
                .padding(.bottom, .xxl)

                unlockCard
                    .padding(.horizontal, .xl)

                Spacer()
                Spacer()
            }
        }
        .onAppear {
            startEntranceAnimation()
        }
    }

    private var logoView: some View {
        ZStack {
            Circle()
                .fill(Color.app.accent)
                .frame(width: 80, height: 80)

            Image(systemName: "lock.fill")
                .font(.largeTitle)
                .foregroundStyle(Color.app.onAccent)
        }
        .scaleEffect(animationPhase == .initial && !reduceMotion ? 0.5 : 1.0)
        .opacity(animationPhase == .initial ? 0 : 1)
        .animation(reduceMotion ? .easeOut(duration: 0.2) : .spring(response: 0.6, dampingFraction: 0.7), value: animationPhase)
    }

    private var greetingView: some View {
        VStack(spacing: .xs) {
            if let name = UserDefaultsStorage.shared.userName {
                Text("Hola, \(name)")
                    .font(.app(.title))
                    .foregroundStyle(Color.app.textPrimary)
            } else {
                Text("Bienvenido")
                    .font(.app(.title))
                    .foregroundStyle(Color.app.textPrimary)
            }

            Text("Verifica tu identidad para continuar")
                .font(.app(.subheadline))
                .foregroundStyle(Color.app.textSecondary)
        }
        .opacity(animationPhase == .initial || animationPhase == .logoAppearing ? 0 : 1)
        .offset(y: animationPhase == .initial || animationPhase == .logoAppearing ? -20 : 0)
        .animation(reduceMotion ? .easeOut(duration: 0.2) : .spring(response: 0.5, dampingFraction: 0.8).delay(0.1), value: animationPhase)
    }

    private var unlockCard: some View {
        GlassCard(cornerRadius: .xl, padding: .xl) {
            VStack(spacing: .lg) {
                Button {
                    performBiometricAuth()
                } label: {
                    HStack(spacing: 12) {
                        Image(systemName: biometricIconName)
                            .font(.title2)
                        Text(biometricLabel)
                            .font(.app(.headline))
                    }
                    .foregroundStyle(Color.app.onAccent)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                    .background(Color.app.accent, in: RoundedRectangle(cornerRadius: 12))
                }
                .disabled(isAuthenticating)

                Button {
                    viewModel.fallbackToPasswordLogin()
                } label: {
                    Text("Usar contraseña")
                        .font(.app(.subheadline))
                        .foregroundStyle(Color.app.accent)
                }
            }
        }
        .opacity(animationPhase == .initial || animationPhase == .logoAppearing || animationPhase == .contentAppearing ? 0 : 1)
        .offset(y: animationPhase == .initial || animationPhase == .logoAppearing || animationPhase == .contentAppearing ? 50 : 0)
        .animation(reduceMotion ? .easeOut(duration: 0.2) : .spring(response: 0.6, dampingFraction: 0.8).delay(0.2), value: animationPhase)
    }

    private func startEntranceAnimation() {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            animationPhase = .logoAppearing
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            animationPhase = .contentAppearing
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            animationPhase = .complete
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
            performBiometricAuth()
        }
    }

    private func performBiometricAuth() {
        guard !isAuthenticating else { return }
        isAuthenticating = true

        Task {
            await viewModel.unlockWithBiometrics()
            isAuthenticating = false
        }
    }
}
