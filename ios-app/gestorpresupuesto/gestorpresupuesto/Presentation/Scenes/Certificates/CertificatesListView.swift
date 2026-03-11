import SwiftUI

struct CertificatesListView: View {
    @StateObject private var viewModel = CertificatesViewModel()
    @State private var showAddCertificate = false
    @State private var showDeleteConfirmation = false
    @State private var certificateToDelete: Certificate?

    var body: some View {
        NavigationStack {
            ZStack {
                Color.app.background.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: Spacing.lg.rawValue) {
                        if viewModel.certificates.isEmpty && viewModel.isLoading {
                            CertificatesSkeleton()
                        } else {
                            if !viewModel.isLoading, let summary = viewModel.summary {
                                VStack(spacing: Spacing.md.rawValue) {
                                    StatCard(
                                        title: "Capital Total",
                                        value: summary.totalCapital.currencyFormatted,
                                        icon: "banknote.fill",
                                        colors: [Color.app.accent, Color.app.accent.opacity(0.7)]
                                    )
                                    StatCard(
                                        title: "Interés Neto",
                                        value: summary.totalNetInterest.currencyFormatted,
                                        icon: "chart.line.uptrend.xyaxis",
                                        colors: [Color.app.success, Color.app.success.opacity(0.7)]
                                    )
                                }
                            }

                            if viewModel.certificates.isEmpty && !viewModel.isLoading {
                                EmptyStateView(
                                    icon: "doc.plaintext",
                                    title: "Sin certificados",
                                    message: "Agrega tu primer certificado financiero"
                                )
                            } else {
                                LazyVStack(spacing: Spacing.md.rawValue) {
                                    ForEach(viewModel.certificates) { cert in
                                        NavigationLink(destination: CertificateDetailView(certificate: cert, viewModel: viewModel)) {
                                            certificateRow(cert)
                                        }
                                        .contextMenu {
                                            Button(role: .destructive) {
                                                certificateToDelete = cert
                                                showDeleteConfirmation = true
                                            } label: {
                                                Label("Eliminar", systemImage: "trash")
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    .padding(Spacing.lg.rawValue)
                }
            }
            .navigationTitle("Certificados")
            .notificationToolbar()
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button { showAddCertificate = true } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $showAddCertificate) {
                AddCertificateView(viewModel: viewModel)
            }
            .refreshable { await viewModel.loadCertificates() }
            .task { await viewModel.loadCertificates() }
            .errorBanner(isPresented: $viewModel.showErrorBanner, message: viewModel.errorBannerMessage)
            .toast(isPresented: $viewModel.showToast, type: viewModel.toastType, message: viewModel.toastMessage)
            .deleteConfirmation(isPresented: $showDeleteConfirmation, itemName: "certificado") {
                if let cert = certificateToDelete {
                    Task { await viewModel.deleteCertificate(cert.id) }
                }
            }
        }
    }

    private func certificateRow(_ cert: Certificate) -> some View {
        SurfaceCard {
            VStack(alignment: .leading, spacing: Spacing.sm.rawValue) {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(cert.bank)
                            .font(.app(.headline))
                            .foregroundStyle(Color.app.textPrimary)
                        Text("\(cert.interestType.displayName) - \(String(format: "%.2f", cert.currentInterestRate))%")
                            .font(.app(.caption))
                            .foregroundStyle(Color.app.textSecondary)
                    }
                    Spacer()
                    StatusBadge.forCertificateStatus(cert.status)
                }

                HStack {
                    VStack(alignment: .leading) {
                        Text("Capital")
                            .font(.caption2)
                            .foregroundStyle(Color.app.textTertiary)
                        Text(cert.effectiveCapital.currencyFormatted)
                            .font(.app(.subheadline))
                            .fontWeight(.semibold)
                    }
                    Spacer()
                    if let projected = cert.projectedPayment {
                        VStack(alignment: .trailing) {
                            Text("Próximo pago")
                                .font(.caption2)
                                .foregroundStyle(Color.app.textTertiary)
                            Text(projected.netInterest.currencyFormatted)
                                .font(.app(.subheadline))
                                .foregroundStyle(Color.app.success)
                        }
                    }
                }
            }
        }
    }
}
