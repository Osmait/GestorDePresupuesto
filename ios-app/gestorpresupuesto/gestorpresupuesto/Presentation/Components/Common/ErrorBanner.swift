import SwiftUI

struct ErrorBanner: View {
    let message: String
    let onDismiss: () -> Void
    
    @State private var offset: CGFloat = -100
    @State private var opacity: Double = 0
    
    var body: some View {
        HStack(spacing: .sm) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 18, weight: .medium))
                .foregroundStyle(.white)
            
            Text(message)
                .font(.app(.subheadline))
                .fontWeight(.medium)
                .foregroundStyle(.white)
                .lineLimit(2)
            
            Spacer()
            
            Button {
                dismissWithAnimation()
            } label: {
                Image(systemName: "xmark")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.8))
            }
        }
        .padding(Spacing.md)
        .background(
            LinearGradient(
                colors: [Color.app.error, Color.app.error.opacity(0.85)],
                startPoint: .leading,
                endPoint: .trailing
            )
        )
        .cornerRadius(Radius.md)
        .shadow(color: Color.app.error.opacity(0.3), radius: 8, x: 0, y: 4)
        .offset(y: offset)
        .opacity(opacity)
        .onAppear {
            withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
                offset = 0
                opacity = 1
            }
            
            let generator = UINotificationFeedbackGenerator()
            generator.notificationOccurred(.error)
            
            DispatchQueue.main.asyncAfter(deadline: .now() + 5) {
                dismissWithAnimation()
            }
        }
    }
    
    private func dismissWithAnimation() {
        withAnimation(.easeOut(duration: 0.3)) {
            offset = -100
            opacity = 0
        }
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            onDismiss()
        }
    }
}

struct ErrorBannerModifier: ViewModifier {
    @Binding var isPresented: Bool
    let message: String
    
    func body(content: Content) -> some View {
        content
            .overlay(alignment: .top) {
                if isPresented {
                    ErrorBanner(message: message) {
                        isPresented = false
                    }
                    .padding(.horizontal)
                    .padding(.top, 8)
                    .transition(.move(edge: .top).combined(with: .opacity))
                }
            }
    }
}

extension View {
    func errorBanner(isPresented: Binding<Bool>, message: String) -> some View {
        self.modifier(ErrorBannerModifier(isPresented: isPresented, message: message))
    }
}

#Preview {
    ZStack {
        Color.app.background.ignoresSafeArea()
        
        VStack {
            ErrorBanner(message: "Error de conexión. Verifica tu conexión a internet.") {}
                .padding()
            
            Spacer()
        }
    }
}
