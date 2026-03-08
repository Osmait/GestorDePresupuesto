import SwiftUI

// MARK: - Credit Cards Skeleton

struct CreditCardsSkeleton: View {
    var body: some View {
        VStack(spacing: Spacing.lg.rawValue) {
            // Summary cards
            HStack(spacing: Spacing.md.rawValue) {
                CardSkeleton()
                CardSkeleton()
            }

            // Card list
            ForEach(0..<3, id: \.self) { _ in
                GlassCard {
                    VStack(alignment: .leading, spacing: Spacing.md.rawValue) {
                        HStack {
                            LoadingSkeleton(height: 20)
                                .frame(width: 140)
                            Spacer()
                            LoadingSkeleton(height: 16)
                                .frame(width: 80)
                        }
                        LoadingSkeleton(height: 8, cornerRadius: .full)
                        HStack {
                            LoadingSkeleton(height: 14)
                                .frame(width: 100)
                            Spacer()
                            LoadingSkeleton(height: 14)
                                .frame(width: 60)
                        }
                    }
                }
            }
        }
        .padding()
    }
}

// MARK: - Loans Skeleton

struct LoansSkeleton: View {
    var body: some View {
        VStack(spacing: Spacing.lg.rawValue) {
            HStack(spacing: Spacing.md.rawValue) {
                CardSkeleton()
                CardSkeleton()
            }

            ForEach(0..<3, id: \.self) { _ in
                SurfaceCard {
                    VStack(alignment: .leading, spacing: Spacing.sm.rawValue) {
                        HStack {
                            LoadingSkeleton(height: 18)
                                .frame(width: 120)
                            Spacer()
                            LoadingSkeleton(height: 24, cornerRadius: .sm)
                                .frame(width: 70)
                        }
                        LoadingSkeleton(height: 14)
                            .frame(width: 200)
                        LoadingSkeleton(height: 6, cornerRadius: .full)
                    }
                }
            }
        }
        .padding()
    }
}

// MARK: - Certificates Skeleton

struct CertificatesSkeleton: View {
    var body: some View {
        VStack(spacing: Spacing.lg.rawValue) {
            // Summary
            GlassCard {
                VStack(spacing: Spacing.md.rawValue) {
                    LoadingSkeleton(height: 14)
                        .frame(width: 120)
                    LoadingSkeleton(height: 32)
                        .frame(width: 160)
                    HStack {
                        LoadingSkeleton(height: 14)
                            .frame(width: 80)
                        Spacer()
                        LoadingSkeleton(height: 14)
                            .frame(width: 80)
                    }
                }
            }

            ForEach(0..<3, id: \.self) { _ in
                SurfaceCard {
                    VStack(alignment: .leading, spacing: Spacing.sm.rawValue) {
                        HStack {
                            LoadingSkeleton(height: 18)
                                .frame(width: 100)
                            Spacer()
                            LoadingSkeleton(height: 22, cornerRadius: .sm)
                                .frame(width: 60)
                        }
                        LoadingSkeleton(height: 14)
                            .frame(width: 180)
                        LoadingSkeleton(height: 14)
                            .frame(width: 140)
                    }
                }
            }
        }
        .padding()
    }
}

// MARK: - Investments Skeleton

struct InvestmentsSkeleton: View {
    var body: some View {
        VStack(spacing: Spacing.lg.rawValue) {
            GlassCard {
                VStack(spacing: Spacing.md.rawValue) {
                    LoadingSkeleton(height: 14)
                        .frame(width: 100)
                    LoadingSkeleton(height: 36)
                        .frame(width: 180)
                }
            }

            // Filter chips
            HStack(spacing: Spacing.sm.rawValue) {
                ForEach(0..<4, id: \.self) { _ in
                    LoadingSkeleton(height: 32, cornerRadius: .full)
                        .frame(width: 80)
                }
            }

            ForEach(0..<3, id: \.self) { _ in
                SurfaceCard {
                    HStack {
                        VStack(alignment: .leading, spacing: Spacing.sm.rawValue) {
                            LoadingSkeleton(height: 16)
                                .frame(width: 100)
                            LoadingSkeleton(height: 14)
                                .frame(width: 60)
                        }
                        Spacer()
                        VStack(alignment: .trailing, spacing: Spacing.sm.rawValue) {
                            LoadingSkeleton(height: 16)
                                .frame(width: 80)
                            LoadingSkeleton(height: 14)
                                .frame(width: 50)
                        }
                    }
                }
            }
        }
        .padding()
    }
}

// MARK: - Analytics Skeleton

struct AnalyticsSkeleton: View {
    var body: some View {
        VStack(spacing: Spacing.lg.rawValue) {
            HStack(spacing: Spacing.md.rawValue) {
                LoadingSkeleton(height: 44, cornerRadius: .md)
                LoadingSkeleton(height: 44, cornerRadius: .md)
            }

            LoadingSkeleton(height: 44, cornerRadius: .md)

            SurfaceCard {
                VStack(spacing: Spacing.md.rawValue) {
                    LoadingSkeleton(height: 18)
                        .frame(width: 160)
                    LoadingSkeleton(height: 200, cornerRadius: .md)
                    ForEach(0..<4, id: \.self) { _ in
                        HStack {
                            LoadingSkeleton(height: 10, cornerRadius: .full)
                                .frame(width: 10)
                            LoadingSkeleton(height: 14)
                                .frame(width: 100)
                            Spacer()
                            LoadingSkeleton(height: 14)
                                .frame(width: 80)
                        }
                    }
                }
            }
        }
        .padding()
    }
}

// MARK: - List Skeleton (generic)

struct ListSkeleton: View {
    let count: Int

    init(count: Int = 5) {
        self.count = count
    }

    var body: some View {
        VStack(spacing: Spacing.md.rawValue) {
            ForEach(0..<count, id: \.self) { _ in
                CardSkeleton()
            }
        }
        .padding()
    }
}
