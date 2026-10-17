import SwiftUI

struct PizzaRewardsView: View {
    @EnvironmentObject private var session: SessionStore
    @State private var mode = 0
    @State private var pasted = ""
    @State private var invalid = false
    @State private var selectedMerchant = OfflineDemoFixtures.merchants[0].id

    var body: some View {
        VStack(spacing: 0) {
            Picker("Modalità", selection: $mode) {
                Text("Guadagna").tag(0)
                Text("Sono una pizzeria").tag(1)
            }
            .pickerStyle(.segmented)
            .padding()
            ScrollView {
                VStack(spacing: 16) {
                    if mode == 0 { earn } else { merchant }
                    Text("Ricompensa demo: \(PizzaRewardRules.rewardPerVisit, specifier: "%.2f") BITZ per visita, una volta al giorno per pizzeria, massimo \(PizzaRewardRules.maxVisitsPerDay) al giorno. Nessun valore reale.")
                        .font(.caption).multilineTextAlignment(.center).foregroundStyle(BitzzaTheme.muted)
                }
                .padding()
            }
        }
        .background(BitzzaTheme.paper)
        .navigationTitle("Pizza-to-earn")
        .navigationBarTitleDisplayMode(.inline)
        .alert("Attenzione", isPresented: Binding(
            get: { session.errorMessage != nil },
            set: { if !$0 { session.errorMessage = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(session.errorMessage ?? "")
        }
    }

    private var earn: some View {
        VStack(spacing: 14) {
            Text("Scansiona il QR esposto in pizzeria dopo aver mangiato.")
                .font(.subheadline).foregroundStyle(BitzzaTheme.muted)
            if QRScannerView.isAvailable {
                QRScannerView { handle($0) }
                    .frame(height: 260)
                    .clipShape(RoundedRectangle(cornerRadius: 18))
            }
            TextField("Oppure incolla il codice della pizzeria", text: $pasted)
                .textInputAutocapitalization(.never).autocorrectionDisabled()
                .padding(14).background(BitzzaTheme.input).clipShape(RoundedRectangle(cornerRadius: 12))
            Button("Riscuoti ricompensa") { handle(pasted) }
                .disabled(pasted.isEmpty)
            if invalid {
                Text("Codice pizzeria non valido.").font(.caption).foregroundStyle(.red)
            }
            if !session.pizzaVisits.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Le tue visite").font(.headline)
                    ForEach(session.pizzaVisits.prefix(10)) { visit in
                        HStack {
                            Text(visit.merchantName)
                            Spacer()
                            Text("+\(visit.reward, specifier: "%.2f") BITZ").foregroundStyle(BitzzaTheme.forest)
                            Text(visit.date, style: .date).font(.caption).foregroundStyle(BitzzaTheme.muted)
                        }
                        .font(.subheadline)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    private var merchant: some View {
        let selected = OfflineDemoFixtures.merchants.first { $0.id == selectedMerchant } ?? OfflineDemoFixtures.merchants[0]
        let code = MerchantEarnCode(merchantId: selected.id, name: selected.name, location: selected.location)
        return VStack(spacing: 14) {
            Picker("Pizzeria", selection: $selectedMerchant) {
                ForEach(OfflineDemoFixtures.merchants) { Text($0.name).tag($0.id) }
            }
            .pickerStyle(.menu)
            QRCodeImage(text: code.uriString)
                .frame(width: 220, height: 220)
                .padding(16).background(.white).clipShape(RoundedRectangle(cornerRadius: 18))
            Text("Mostra questo QR ai clienti. Ogni cliente può riscuoterlo una volta al giorno.")
                .font(.subheadline).multilineTextAlignment(.center).foregroundStyle(BitzzaTheme.muted)
            ShareLink(item: code.uriString) { Label("Condividi codice", systemImage: "square.and.arrow.up") }
        }
    }

    private func handle(_ text: String) {
        if let code = MerchantEarnCode.parse(text) {
            invalid = false
            session.claimPizzaReward(code)
            pasted = ""
        } else {
            invalid = true
        }
    }
}
