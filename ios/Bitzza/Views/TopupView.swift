import SwiftUI

struct TopupView: View {
    @EnvironmentObject private var session: SessionStore
    @Environment(\.openURL) private var openURL
    @Environment(\.scenePhase) private var scenePhase
    @State private var config: TopupConfig?
    @State private var records: [TopupRecord] = []
    @State private var amount = 20
    @State private var busy = false
    @State private var waitingPayment = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if let config, !config.enabled {
                    Text("Le ricariche non sono ancora attive sul server.").foregroundStyle(BitzzaTheme.muted)
                } else if let config {
                    Text("Ricarica con carta").font(.headline)
                    Stepper("Importo: \(amount) € = \(amount) BITZ", value: $amount, in: config.minEur...config.maxEur, step: 5)
                    Button {
                        Task { await start() }
                    } label: {
                        Text("Paga con carta (Stripe test)").fontWeight(.bold).frame(maxWidth: .infinity).padding(14)
                            .foregroundStyle(.white).background(BitzzaTheme.tomato).clipShape(RoundedRectangle(cornerRadius: 13))
                    }
                    .disabled(busy)
                    .opacity(busy ? 0.5 : 1)
                    Text("Modalità test: nessun addebito reale. Usa la carta 4242 4242 4242 4242, data futura e CVC qualsiasi. Il saldo si aggiorna quando Stripe conferma il pagamento.")
                        .font(.caption).foregroundStyle(BitzzaTheme.muted)
                    if waitingPayment {
                        Label("In attesa della conferma di pagamento…", systemImage: "hourglass").font(.subheadline)
                    }
                } else {
                    ProgressView()
                }
                if !records.isEmpty {
                    Text("Ultime ricariche").font(.headline)
                    ForEach(records) { r in
                        HStack {
                            Image(systemName: r.status == "paid" ? "checkmark.circle.fill" : "clock")
                                .foregroundStyle(r.status == "paid" ? BitzzaTheme.forest : BitzzaTheme.muted)
                            Text(r.status == "paid" ? "Accreditata" : "In attesa")
                            Spacer()
                            Text("+\(r.amountEur, specifier: "%.2f") BITZ").foregroundStyle(BitzzaTheme.muted)
                        }.font(.subheadline)
                    }
                }
            }
            .padding()
        }
        .background(BitzzaTheme.paper)
        .navigationTitle("Ricarica")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await reload() }
        .task { await reload() }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active, waitingPayment { Task { await settle() } }
        }
        .alert("Attenzione", isPresented: Binding(
            get: { session.errorMessage != nil },
            set: { if !$0 { session.errorMessage = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: { Text(session.errorMessage ?? "") }
    }

    private func reload() async {
        if let c = await session.withAPI({ api, token in try await api.topupConfig(token: token) }) {
            config = c
            amount = min(max(amount, c.minEur), c.maxEur)
        }
        if let r = await session.withAPI({ api, token in try await api.topups(token: token) }) { records = r }
    }

    private func start() async {
        busy = true
        defer { busy = false }
        let eur = amount
        if let url = await session.withAPI({ api, token in try await api.startTopup(amountEur: eur, token: token) }) {
            waitingPayment = true
            openURL(url)
        }
    }

    // Il webhook può arrivare qualche secondo dopo il ritorno nell'app: riprova un paio di volte.
    private func settle() async {
        for _ in 0..<5 {
            await reload()
            if !records.contains(where: { $0.status == "pending" }) { break }
            try? await Task.sleep(for: .seconds(2))
        }
        await session.refresh()
        if !records.contains(where: { $0.status == "pending" }) { waitingPayment = false }
    }
}
