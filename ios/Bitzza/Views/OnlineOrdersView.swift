import SwiftUI

struct OnlineOrdersView: View {
    @EnvironmentObject private var session: SessionStore
    @State private var mode = 0
    @State private var mine: [OnlineOrder] = []
    @State private var available: [OnlineOrder] = []
    @State private var jobs: [OnlineOrder] = []
    @State private var storeId = DeliveryDemoFixtures.jobs[0].id
    @State private var itemsText = "20"
    @State private var weight = 5.0
    @State private var vehicle: DeliveryVehicle = .bicycle
    @State private var busy = false
    @State private var requestKey = UUID().uuidString

    private var job: DeliveryJob { DeliveryDemoFixtures.jobs.first { $0.id == storeId } ?? DeliveryDemoFixtures.jobs[0] }
    private var itemsMinor: Int {
        Int(((Double(itemsText.replacingOccurrences(of: ",", with: ".")) ?? 0) * 100).rounded())
    }
    private var activeMine: OnlineOrder? { mine.first { $0.status != "delivered" && $0.status != "cancelled" } }
    private var activeJob: OnlineOrder? { jobs.first { $0.status != "delivered" && $0.status != "cancelled" } }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Picker("Modalità", selection: $mode) {
                    Text("Ordino").tag(0)
                    Text("Faccio il corriere").tag(1)
                }
                .pickerStyle(.segmented)
                if mode == 0 { customer } else { courier }
                Text("Pagamento tenuto in garanzia (escrow) dal server e rilasciato al corriere alla consegna. Valore in BITZ interni, non denaro reale.")
                    .font(.caption).foregroundStyle(BitzzaTheme.muted)
            }
            .padding()
        }
        .background(BitzzaTheme.paper)
        .navigationTitle("Ordini reali")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await reload() }
        .task { await reload() }
        .alert("Attenzione", isPresented: Binding(
            get: { session.errorMessage != nil },
            set: { if !$0 { session.errorMessage = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: { Text(session.errorMessage ?? "") }
    }

    @ViewBuilder private var customer: some View {
        if let order = activeMine {
            card(order) {
                if order.status == "open" {
                    action("Annulla e rimborsa", color: BitzzaTheme.tomato) { await run(order, "cancel") }
                }
            }
        } else {
            form
        }
        ForEach(mine.filter { $0.status == "delivered" || $0.status == "cancelled" }.prefix(8)) { o in
            HStack {
                Image(systemName: o.status == "delivered" ? "checkmark.circle.fill" : "xmark.circle")
                    .foregroundStyle(o.status == "delivered" ? BitzzaTheme.forest : BitzzaTheme.muted)
                Text(o.store)
                Spacer()
                Text("\(o.total, specifier: "%.2f") BITZ").foregroundStyle(BitzzaTheme.muted)
            }.font(.subheadline)
        }
    }

    private var form: some View {
        VStack(alignment: .leading, spacing: 14) {
            Picker("Negozio", selection: $storeId) {
                ForEach(DeliveryDemoFixtures.jobs) { Text($0.store).tag($0.id) }
            }.pickerStyle(.menu)
            Text("\(job.area) · \(job.distanceKm, specifier: "%.1f") km").font(.caption).foregroundStyle(BitzzaTheme.muted)
            Picker("Mezzo", selection: $vehicle) {
                ForEach(DeliveryVehicle.allCases) { Label($0.title, systemImage: $0.symbol).tag($0) }
            }.pickerStyle(.segmented)
            TextField("Totale spesa in BITZ", text: $itemsText)
                .keyboardType(.decimalPad)
                .padding(14).background(BitzzaTheme.input).clipShape(RoundedRectangle(cornerRadius: 12))
            Stepper("Peso stimato: \(Int(weight)) kg", value: $weight, in: 1...50)
            if !DeliveryPricing.isSuitable(vehicle, distanceKm: job.distanceKm) {
                Text("Mezzo non adatto a questa distanza.").font(.caption).foregroundStyle(.red)
            }
            action("Ordina e paga con BITZ", color: BitzzaTheme.tomato,
                   disabled: itemsMinor <= 0 || !DeliveryPricing.isSuitable(vehicle, distanceKm: job.distanceKm)) {
                await place()
            }
            Text("Il prezzo finale (corriere, commissione, cashback) è calcolato dal server.")
                .font(.caption).foregroundStyle(BitzzaTheme.muted)
        }
    }

    @ViewBuilder private var courier: some View {
        if let order = activeJob {
            card(order) {
                if let next = order.nextStatus, let title = order.nextActionTitle {
                    action(title, color: BitzzaTheme.forest) { await run(order, "advance", expected: order.status, next: next) }
                }
                if order.status == "accepted" {
                    action("Rinuncia", color: BitzzaTheme.tomato) { await run(order, "release") }
                }
            }
        } else if available.isEmpty {
            Text("Nessun ordine disponibile adesso. Trascina per aggiornare.").foregroundStyle(BitzzaTheme.muted)
        } else {
            Text("Ordini disponibili").font(.headline)
            ForEach(available) { o in
                card(o) { action("Accetta", color: BitzzaTheme.forest) { await run(o, "accept") } }
            }
        }
    }

    private func card<Extra: View>(_ o: OnlineOrder, @ViewBuilder extra: () -> Extra) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(o.store).font(.headline)
            Text("\(o.area) · \(o.distanceKm, specifier: "%.1f") km · \(o.weightKg, specifier: "%.0f") kg").font(.caption).foregroundStyle(BitzzaTheme.muted)
            Label(o.statusTitle, systemImage: "shippingbox").font(.subheadline.bold()).foregroundStyle(BitzzaTheme.forest)
            Text("Spesa \(o.items, specifier: "%.2f") · Corriere \(o.fee, specifier: "%.2f") · Totale \(o.total, specifier: "%.2f") BITZ").font(.caption)
            Text("Cashback alla consegna: \(o.cashback, specifier: "%.2f") BITZ").font(.caption).foregroundStyle(BitzzaTheme.muted)
            extra()
        }
        .padding(14).frame(maxWidth: .infinity, alignment: .leading)
        .background(BitzzaTheme.card).clipShape(RoundedRectangle(cornerRadius: 14))
    }

    private func action(_ title: String, color: Color, disabled: Bool = false, _ run: @escaping () async -> Void) -> some View {
        Button { Task { await run() } } label: {
            Text(title).fontWeight(.bold).frame(maxWidth: .infinity).padding(14)
                .foregroundStyle(.white).background(color).clipShape(RoundedRectangle(cornerRadius: 13))
        }
        .disabled(disabled || busy)
        .opacity(disabled || busy ? 0.5 : 1)
    }

    private func reload() async {
        let result = await session.withAPI { api, token in
            (try await api.listOrders("mine", token: token),
             try await api.listOrders("available", token: token),
             try await api.listOrders("deliveries", token: token))
        }
        if let result { (mine, available, jobs) = result }
    }

    private func place() async {
        busy = true
        defer { busy = false }
        let body = NewOnlineOrder(store: job.store, area: job.area, itemsMinor: itemsMinor,
                                  weightKg: weight, distanceKm: job.distanceKm, vehicle: vehicle.rawValue)
        let key = requestKey
        if await session.withAPI({ api, token in try await api.placeOrder(body, key: key, token: token) }) != nil {
            requestKey = UUID().uuidString
            await session.refresh()
            await reload()
        }
    }

    private func run(_ order: OnlineOrder, _ action: String, expected: String? = nil, next: String? = nil) async {
        busy = true
        defer { busy = false }
        let ok: Void? = await session.withAPI { api, token in
            try await api.orderAction(order.id, action, expectedStatus: expected, token: token)
        }
        if ok != nil {
            await session.refresh()
        }
        await reload()
    }
}
