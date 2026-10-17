import SwiftUI
import UIKit

struct WalletHomeView: View {
    @EnvironmentObject private var session: SessionStore
    @State private var showingSend = false
    @State private var showingCopied = false
    @State private var transactionSearch = ""
    @State private var transactionType = "all"

    private var dashboard: DashboardData? {
        session.dashboard
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    if dashboard != nil {
                        welcome
                        balanceCard
                        actions
                        activity
                    } else if session.isLoading {
                        walletLoadingState
                    } else {
                        walletUnavailableState
                    }
                }
                .padding(18)
            }
            .background(BitzzaTheme.paper)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    HStack(spacing: 9) {
                        Image("Logo")
                            .resizable()
                            .scaledToFill()
                            .frame(width: 30, height: 30)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                        Text("BITZZA")
                            .font(.system(size: 14, weight: .black, design: .rounded))
                            .tracking(2)
                        Text("DEMO")
                            .font(.system(size: 8, weight: .bold, design: .rounded))
                            .tracking(1)
                            .padding(.horizontal, 7)
                            .padding(.vertical, 5)
                            .background(BitzzaTheme.gold.opacity(0.25))
                            .clipShape(Capsule())
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Esci", role: .destructive) {
                        session.signOut()
                    }
                    .font(.subheadline.weight(.semibold))
                }
            }
            .refreshable {
                await session.refresh()
            }
            .sheet(isPresented: $showingSend) {
                SendPaymentView(initialRecipient: session.paymentRecipient)
                    .environmentObject(session)
                    .presentationDetents([.medium, .large])
                    .presentationDragIndicator(.visible)
            }
            .task {
                if dashboard == nil {
                    await session.refresh()
                }
            }
            .onChange(of: session.paymentRecipient) { _, recipient in
                guard !recipient.isEmpty else { return }
                showingSend = true
            }
            .onChange(of: showingSend) { _, isPresented in
                if !isPresented { session.paymentRecipient = "" }
            }
            .alert("Indirizzo copiato", isPresented: $showingCopied) {
                Button("OK", role: .cancel) {}
            } message: {
                Text("Hai copiato l’indirizzo demo. Non è un indirizzo blockchain reale.")
            }
        }
    }

    private var welcome: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text("IL TUO SPAZIO BITZZA")
                .font(.system(size: 10, weight: .bold, design: .rounded))
                .tracking(1.6)
                .foregroundStyle(BitzzaTheme.tomato)
            Text("Ciao, \(dashboard?.profile.email.split(separator: "@").first.map(String.init) ?? "benvenuto").")
                .font(.system(size: 26, weight: .bold, design: .rounded))
                .tracking(-1)
                .foregroundStyle(BitzzaTheme.forest)
            Text("Un piccolo passo alla volta, verso un’economia più vicina.")
                .font(.subheadline)
                .foregroundStyle(BitzzaTheme.muted)
        }
        .padding(.vertical, 3)
    }

    private var walletLoadingState: some View {
        VStack(spacing: 14) {
            ProgressView()
                .controlSize(.large)
                .tint(BitzzaTheme.tomato)
            Text("Caricamento del wallet demo…")
                .font(.headline)
                .foregroundStyle(BitzzaTheme.forest)
            Text("Stiamo recuperando saldo e attività.")
                .font(.subheadline)
                .foregroundStyle(BitzzaTheme.muted)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 72)
        .accessibilityElement(children: .combine)
    }

    private var walletUnavailableState: some View {
        ContentUnavailableView {
            Label("Wallet non disponibile", systemImage: "wifi.exclamationmark")
        } description: {
            Text("Controlla che l’API BITZZA sia avviata e riprova. Il saldo verrà mostrato solo dopo aver caricato i dati.")
        } actions: {
            Button {
                Task { await session.refresh() }
            } label: {
                Label("Riprova", systemImage: "arrow.clockwise")
            }
            .buttonStyle(.borderedProminent)
            .tint(BitzzaTheme.tomato)
            .disabled(session.isLoading)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 48)
    }

    private var balanceCard: some View {
        VStack(alignment: .leading, spacing: 22) {
            HStack {
                Text("IL TUO SALDO DEMO")
                    .font(.system(size: 10, weight: .bold, design: .rounded))
                    .tracking(1.7)
                    .foregroundStyle(.white.opacity(0.73))
                Spacer()
                Label("Wallet attivo", systemImage: "circle.fill")
                    .font(.caption.weight(.medium))
                    .foregroundStyle(.white.opacity(0.9))
                    .labelStyle(StatusLabelStyle())
            }
            HStack(alignment: .center) {
                VStack(alignment: .leading, spacing: 8) {
                    Text(session.settings?.privacyMode == 1
                         ? "••••••"
                         : String(format: "%.2f", dashboard?.balance.balance ?? 0))
                        .font(.system(size: 48, weight: .bold, design: .rounded))
                        .tracking(-2.5)
                        .contentTransition(.numericText())
                        .foregroundStyle(.white)
                    Text("BITZ")
                        .font(.system(size: 11, weight: .bold, design: .rounded))
                        .tracking(2)
                        .foregroundStyle(.white.opacity(0.72))
                }
                Spacer(minLength: 6)
                Image("Logo")
                    .resizable()
                    .scaledToFill()
                    .frame(width: 66, height: 66)
                    .clipShape(RoundedRectangle(cornerRadius: 18))
                    .overlay(RoundedRectangle(cornerRadius: 18).stroke(.white.opacity(0.8), lineWidth: 2))
                    .rotationEffect(.degrees(3))
            }
            Text(session.settings?.privacyMode == 1 ? "Indirizzo nascosto" : (dashboard?.profile.walletAddress ?? ""))
                .font(.system(size: 10, weight: .medium, design: .monospaced))
                .foregroundStyle(.white.opacity(0.72))
                .lineLimit(1)
                .textSelection(.enabled)
            HStack(spacing: 9) {
                Button {
                    guard session.settings?.privacyMode != 1 else { return }
                    UIPasteboard.general.string = dashboard?.profile.walletAddress
                    showingCopied = true
                } label: {
                    Label("Copia indirizzo", systemImage: "doc.on.doc")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(BalanceSecondaryButtonStyle())
                .disabled(session.settings?.privacyMode == 1 || dashboard?.profile.walletAddress.isEmpty != false)
                Button {
                    showingSend = true
                } label: {
                    Label("Invia BITZ demo", systemImage: "arrow.up.right")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(BalancePrimaryButtonStyle())
            }
        }
        .padding(21)
        .background {
            ZStack(alignment: .topTrailing) {
                LinearGradient(
                    colors: [BitzzaTheme.forestFill, Color(red: 40.0 / 255, green: 96.0 / 255, blue: 59.0 / 255)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                Circle()
                    .fill(BitzzaTheme.tomato.opacity(0.12))
                    .frame(width: 190, height: 190)
                    .offset(x: 75, y: -85)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .shadow(color: BitzzaTheme.forestFill.opacity(0.18), radius: 16, y: 9)
    }

    private var actions: some View {
        HStack(spacing: 12) {
            Label("Demo locale", systemImage: "leaf.fill")
            Spacer()
            Text("Nessun fondo reale")
                .foregroundStyle(BitzzaTheme.muted)
        }
        .font(.caption.weight(.semibold))
        .foregroundStyle(BitzzaTheme.forest)
        .padding(.horizontal, 15)
        .padding(.vertical, 13)
        .background(BitzzaTheme.card)
        .clipShape(RoundedRectangle(cornerRadius: 13))
    }

    private var activity: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text("Attività recente")
                    .font(.system(size: 19, weight: .bold, design: .rounded))
                    .tracking(-0.5)
                Spacer()
                Button {
                    Task { await session.refresh() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                        .font(.subheadline.weight(.semibold))
                }
                .accessibilityLabel("Aggiorna attività")
            }
            .foregroundStyle(BitzzaTheme.forest)

            TextField("Cerca attività", text: $transactionSearch)
                .textFieldStyle(.roundedBorder)
                .accessibilityLabel("Cerca transazioni")
            Picker("Tipo di transazione", selection: $transactionType) {
                Text("Tutte").tag("all")
                Text("Inviate").tag("sent")
                Text("Ricevute").tag("received")
            }
            .pickerStyle(.segmented)

            let transactions = (dashboard?.transactions ?? []).filter { transaction in
                let matchesType = transactionType == "all" || transaction.type == transactionType
                let query = transactionSearch.trimmingCharacters(in: .whitespacesAndNewlines)
                let matchesSearch = query.isEmpty
                    || transaction.otherParty.localizedCaseInsensitiveContains(query)
                    || (transaction.description ?? "").localizedCaseInsensitiveContains(query)
                return matchesType && matchesSearch
            }
            if !transactions.isEmpty {
                ForEach(transactions) { transaction in
                    TransactionRow(transaction: transaction)
                }
            } else if session.isLoading {
                ProgressView().frame(maxWidth: .infinity).padding(28)
            } else if (dashboard?.transactions ?? []).isEmpty {
                VStack(spacing: 10) {
                    Image(systemName: "arrow.left.arrow.right")
                        .font(.title2)
                        .foregroundStyle(BitzzaTheme.tomato)
                        .frame(width: 48, height: 48)
                        .background(BitzzaTheme.tomato.opacity(0.1))
                        .clipShape(RoundedRectangle(cornerRadius: 15))
                    Text("La tua attività inizia qui")
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(BitzzaTheme.forest)
                    Text("Quando invii o ricevi BITZ demo, vedrai le operazioni in questo spazio.")
                        .font(.caption)
                        .multilineTextAlignment(.center)
                        .foregroundStyle(BitzzaTheme.muted)
                    Button("Prova un invio demo") { showingSend = true }
                        .font(.caption.weight(.bold))
                        .foregroundStyle(BitzzaTheme.tomato)
                        .padding(.top, 3)
                }
                .frame(maxWidth: .infinity)
                .padding(24)
                .background(BitzzaTheme.card)
                .clipShape(RoundedRectangle(cornerRadius: 16))
            } else {
                VStack(spacing: 9) {
                    Image(systemName: "magnifyingglass")
                        .font(.title2)
                        .foregroundStyle(BitzzaTheme.muted)
                    Text("Nessun risultato")
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(BitzzaTheme.forest)
                    Text("Prova un’altra ricerca o modifica il filtro.")
                        .font(.caption)
                        .multilineTextAlignment(.center)
                        .foregroundStyle(BitzzaTheme.muted)
                    Button("Rimuovi filtri") {
                        transactionSearch = ""
                        transactionType = "all"
                    }
                    .font(.caption.weight(.bold))
                    .foregroundStyle(BitzzaTheme.tomato)
                    .padding(.top, 3)
                }
                .frame(maxWidth: .infinity)
                .padding(24)
                .background(BitzzaTheme.paper)
                .clipShape(RoundedRectangle(cornerRadius: 16))
            }
        }
        .padding(17)
        .background(BitzzaTheme.card)
        .clipShape(RoundedRectangle(cornerRadius: 19))
    }
}

private struct TransactionRow: View {
    @EnvironmentObject private var session: SessionStore
    let transaction: WalletTransaction

    private var isSent: Bool { transaction.type == "sent" }

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: isSent ? "arrow.up.right" : "arrow.down.left")
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(isSent ? BitzzaTheme.tomato : BitzzaTheme.forest)
                .frame(width: 39, height: 39)
                .background((isSent ? BitzzaTheme.tomato : BitzzaTheme.forest).opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: 12))
            VStack(alignment: .leading, spacing: 4) {
                Text("\(isSent ? "Inviato a" : "Ricevuto da") \(transaction.otherParty)")
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(1)
                Text(transaction.description ?? "Pagamento BITZ")
                    .font(.caption)
                    .foregroundStyle(BitzzaTheme.muted)
                    .lineLimit(1)
            }
            Spacer(minLength: 4)
            Text(session.settings?.privacyMode == 1
                 ? "•••• BITZ"
                 : "\(isSent ? "−" : "+")\(transaction.amount.formatted(.number.precision(.fractionLength(2)))) BITZ")
                .font(.subheadline.weight(.bold).monospacedDigit())
                .foregroundStyle(isSent ? BitzzaTheme.tomato : BitzzaTheme.forest)
        }
        .padding(12)
        .background(BitzzaTheme.paper)
        .clipShape(RoundedRectangle(cornerRadius: 13))
    }
}

private struct StatusLabelStyle: LabelStyle {
    func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: 6) {
            configuration.icon
                .font(.system(size: 6))
                .foregroundStyle(BitzzaTheme.gold)
            configuration.title
        }
        .padding(.horizontal, 9)
        .padding(.vertical, 6)
        .background(.white.opacity(0.12))
        .clipShape(Capsule())
    }
}

private struct BalanceSecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 11, weight: .semibold))
            .foregroundStyle(.white)
            .padding(.vertical, 11)
            .background(.white.opacity(configuration.isPressed ? 0.2 : 0.1))
            .clipShape(RoundedRectangle(cornerRadius: 10))
    }
}

private struct BalancePrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 11, weight: .bold))
            .foregroundStyle(Color(red: 64.0 / 255, green: 37.0 / 255, blue: 22.0 / 255))
            .padding(.vertical, 11)
            .background(configuration.isPressed ? BitzzaTheme.gold.opacity(0.8) : BitzzaTheme.gold)
            .clipShape(RoundedRectangle(cornerRadius: 10))
    }
}
