import SwiftUI

struct GradientProgressBar: View {
    let progress: Double
    let height: CGFloat
    var showLabel: Bool = true
    var isCritical: Bool = false
    var isWarning: Bool = false
    
    private var gradientColors: [Color] {
        if isCritical {
            return Color.app.gradientError
        } else if isWarning {
            return Color.app.gradientWarning
        }
        return Color.app.gradientSuccess
    }
    
    var body: some View {
        VStack(spacing: .sm) {
            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: height / 2)
                        .fill(Color.app.surfaceSecondary)
                    
                    RoundedRectangle(cornerRadius: height / 2)
                        .fill(
                            LinearGradient(
                                colors: gradientColors,
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .frame(width: max(min(progress, 1.0), 0) * geometry.size.width)
                        .animation(.spring(response: 0.6, dampingFraction: 0.7), value: progress)
                }
            }
            .frame(height: height)
            
            if showLabel {
                HStack {
                    Text("\(Int(progress * 100))%")
                        .font(.caption2)
                        .foregroundStyle(Color.app.textSecondary)
                    
                    Spacer()
                    
                    if progress >= 1.0 {
                        Text("Excedido")
                            .font(.caption2)
                            .foregroundStyle(Color.app.error)
                    } else if progress >= 0.7 {
                        Text("Casi límite")
                            .font(.caption2)
                            .foregroundStyle(Color.app.warning)
                    }
                }
            }
        }
    }
}

struct CircularProgressView: View {
    let progress: Double
    let lineWidth: CGFloat
    var size: CGFloat = 80
    var showPercentage: Bool = true
    var isCritical: Bool = false
    var isWarning: Bool = false
    
    private var gradientColors: [Color] {
        if isCritical {
            return Color.app.gradientError
        } else if isWarning {
            return Color.app.gradientWarning
        }
        return Color.app.gradientSuccess
    }
    
    var body: some View {
        ZStack {
            Circle()
                .stroke(Color.app.surfaceSecondary, lineWidth: lineWidth)
            
            Circle()
                .trim(from: 0, to: min(progress, 1.0))
                .stroke(
                    LinearGradient(
                        colors: gradientColors,
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    style: StrokeStyle(lineWidth: lineWidth, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))
                .animation(.spring(response: 0.6, dampingFraction: 0.7), value: progress)
            
            if showPercentage {
                VStack(spacing: 2) {
                    Text("\(Int(min(progress, 1.0) * 100))")
                        .font(.system(size: size * 0.28, weight: .bold, design: .rounded))
                        .foregroundStyle(Color.app.textPrimary)
                    Text("%")
                        .font(.system(size: size * 0.15, weight: .medium))
                        .foregroundStyle(Color.app.textSecondary)
                }
            }
        }
        .frame(width: size, height: size)
    }
}

struct AnimatedBarChart: View {
    let data: [ChartData]
    var showLabels: Bool = true
    
    @State private var animatedValues: [Double] = []
    
    struct ChartData: Identifiable, Equatable {
        let id = UUID()
        let label: String
        let value: Double
        let color: Color
        
        static func == (lhs: ChartData, rhs: ChartData) -> Bool {
            lhs.label == rhs.label && lhs.value == rhs.value
        }
    }
    
    var maxValue: Double {
        data.map { abs($0.value) }.max() ?? 1
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: .md) {
            ForEach(Array(data.enumerated()), id: \.element.id) { index, item in
                HStack(spacing: .md) {
                    if showLabels {
                        Text(item.label)
                            .font(.caption)
                            .foregroundStyle(Color.app.textSecondary)
                            .frame(width: 80, alignment: .leading)
                            .lineLimit(1)
                    }
                    
                    GeometryReader { geometry in
                        ZStack(alignment: .leading) {
                            RoundedRectangle(cornerRadius: 4)
                                .fill(Color.app.surfaceSecondary)
                            
                            RoundedRectangle(cornerRadius: 4)
                                .fill(
                                    LinearGradient(
                                        colors: [item.color, item.color.opacity(0.7)],
                                        startPoint: .leading,
                                        endPoint: .trailing
                                    )
                                )
                                .frame(width: animatedValues.indices.contains(index) 
                                    ? (abs(animatedValues[index]) / maxValue) * geometry.size.width 
                                    : 0)
                        }
                    }
                    .frame(height: 24)
                    
                    Text(abs(item.value).currencyFormatted)
                        .font(.caption)
                        .foregroundStyle(Color.app.textPrimary)
                        .frame(width: 70, alignment: .trailing)
                }
            }
        }
        .onAppear {
            animateBars()
        }
        .onChange(of: data) { _ in
            animateBars()
        }
    }
    
    private func animateBars() {
        animatedValues = Array(repeating: 0, count: data.count)
        
        for (index, item) in data.enumerated() {
            DispatchQueue.main.asyncAfter(deadline: .now() + Double(index) * 0.1) {
                withAnimation(.spring(response: 0.5, dampingFraction: 0.7)) {
                    if animatedValues.indices.contains(index) {
                        animatedValues[index] = item.value
                    }
                }
            }
        }
    }
}

struct BudgetProgressCard: View {
    let budget: BudgetResponse
    
    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.sm.rawValue) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(budget.displayName)
                        .font(.app(.caption))
                        .fontWeight(.medium)
                        .foregroundStyle(Color.app.textPrimary)
                        .lineLimit(1)
                    
                    Text(budget.amount.currencyFormatted)
                        .font(.system(size: 18, weight: .bold, design: .rounded))
                        .foregroundStyle(Color.app.textPrimary)
                }
                
                Spacer()
                
                CircularProgressView(
                    progress: budget.progress,
                    lineWidth: 6,
                    size: 52,
                    showPercentage: true,
                    isCritical: budget.isCritical,
                    isWarning: budget.isWarning
                )
            }
            
            GradientProgressBar(
                progress: budget.progress,
                height: 6,
                showLabel: false,
                isCritical: budget.isCritical,
                isWarning: budget.isWarning
            )
            
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Gastado")
                        .font(.system(size: 10))
                        .foregroundStyle(Color.app.textTertiary)
                    Text(budget.spent.currencyFormatted)
                        .font(.app(.caption))
                        .fontWeight(.medium)
                        .foregroundStyle(Color.app.textSecondary)
                }
                
                Spacer()
                
                VStack(alignment: .trailing, spacing: 2) {
                    Text(budget.isOverBudget ? "Excedido" : "Disponible")
                        .font(.system(size: 10))
                        .foregroundStyle(Color.app.textTertiary)
                    Text(budget.remaining.currencyFormatted)
                        .font(.app(.caption))
                        .fontWeight(.medium)
                        .foregroundStyle(budget.isOverBudget ? Color.app.error : Color.app.success)
                }
            }
        }
        .padding(Spacing.md.rawValue)
        .frame(width: 180)
        .background(
            RoundedRectangle(cornerRadius: Radius.lg.rawValue)
                .fill(.ultraThinMaterial)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radius.lg.rawValue)
                .stroke(Color.primary.opacity(0.1), lineWidth: 0.5)
        )
        .cardShadow()
    }
}

#Preview {
    ZStack {
        Color.app.background.ignoresSafeArea()
        
        ScrollView {
            VStack(spacing: 24) {
                GradientProgressBar(progress: 0.65, height: 12)
                GradientProgressBar(progress: 0.85, height: 12, isWarning: true)
                GradientProgressBar(progress: 1.1, height: 12, isCritical: true)
                
                HStack(spacing: 16) {
                    CircularProgressView(progress: 0.65, lineWidth: 8)
                    CircularProgressView(progress: 0.85, lineWidth: 8, isWarning: true)
                    CircularProgressView(progress: 1.0, lineWidth: 8, isCritical: true)
                }
            }
            .padding()
        }
    }
}
