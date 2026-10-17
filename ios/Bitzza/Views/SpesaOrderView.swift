import SwiftUI

struct SpesaOrderView: View {
    @EnvironmentObject private var session: SessionStore
    @State private var storeId = DeliveryDemoFixtures.jobs[0].id
    @State private var itemsText = "25"
    @State private var weight = 5.0
    @State private var vehicle: DeliveryVehicle = .bicycle

    private var job: DeliveryJob { DeliveryDemoFixtures.jobs.first { $0.id == storeId } ?? DeliveryDemoFixtures.jobs[0] }
    private var items: Double { Double(itemsText.replacingOccurrences(of: ",", with: ".")) ?? 0 }
    private var earnings: Double { DeliveryPricing.earnings(vehicle: vehicle, distanceKm: job.distanceKm, weightKg: weight) }
    private var commission: Double { SpesaPricing.commission(base: items + earnings) }
    private var total: Double { items + earnings + commission }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if let current = session.spesaOrders.first(where: { !$0.isDelivered }) {
                    tracking(current)
                } else {
                    form
                }
                let history = session.spesaOrders.filter(\.isDelivered)
                if !history.isEmpty {
                    Text("Ordini consegnati").font(.headline)
                    ForEach(history.prefix(10)) { order in
                        HStack {
                            Image(systemName: "checkmark.circle.fill").foregroundStyle(BitzzaTheme.forest)
                            Text(order.store)
                            Spacer()
                            Text("−\(order.total, specifier: "%.2f") BITZ").foregroundStyle(BitzzaTheme.muted)
                        }
                        .font(.subheadline)
                    }
                }
                Text("Simulazione: nessun ordine, pagamento o corriere reale. Cashback \(Int(SpesaPricing.cashbackPercent))% sulla spesa (max \(Int(SpesaPricing.cashbackCap)) BITZ).")
                    .font(.caption).foregroundStyle(BitzzaTheme.muted)
            }
            .padding()
        }
        .background(BitzzaTheme.paper)
        .navigationTitle("Spesa a casa")
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

    private var form: some View {
        VStack(alignment: .leading, spacing: 14) {
            Picker("Negozio", selection: $storeId) {
                ForEach(DeliveryDemoFixtures.jobs) { Text($0.store).tag($0.id) }
            }
            .pickerStyle(.menu)
            Text("\(job.area) · \(job.distanceKm, specifier: "%.1f") km").font(.caption).foregroundStyle(BitzzaTheme.muted)
            Picker("Mezzo", selection: $vehicle) {
                ForEach(DeliveryVehicle.allCases) { Label($0.title, systemImage: $0.symbol).tag($0) }
            }
            .pickerStyle(.segmented)
            TextField("Totale spesa in BITZ demo", text: $itemsText)
                .keyboardType(.decimalPad)
                .padding(14).background(BitzzaTheme.input).clipShape(RoundedRectangle(cornerRadius: 12))
            Stepper("Peso stimato: \(Int(weight)) kg", value: $weight, in: 1...50)
            VStack(alignment: .leading, spacing: 6) {
                row("Spesa", items)
                row("Corriere (\(vehicle.title))", earnings)
                row("Commissione SpesaGo", commission)
                Divider()
                row("Totale", total, bold: true)
                if !DeliveryPricing.isSuitable(vehicle, distanceKm: job.distanceKm) {
                    Text("Mezzo non adatto a questa distanza.").font(.caption).foregroundStyle(.red)
                }
            }
            .padding(14).background(BitzzaTheme.card).clipShape(RoundedRectangle(cornerRadius: 14))
            Button {
                _ = session.placeSpesaOrder(job: job, itemsTotal: items, weightKg: weight, vehicle: vehicle)
            } label: {
                Text("Ordina e paga con BITZ").fontWeight(.bold).frame(maxWidth: .infinity).padding(14)
                    .foregroundStyle(.white).background(BitzzaTheme.tomato).clipShape(RoundedRectangle(cornerRadius: 13))
            }
            .disabled(items <= 0 || !DeliveryPricing.isSuitable(vehicle, distanceKm: job.distanceKm))
        }
    }

    private func tracking(_ order: SpesaOrder) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Ordine in corso · \(order.store)").font(.headline)
            ForEach(SpesaOrder.steps.indices, id: \.self) { index in
                Label(SpesaOrder.steps[index], systemImage: index <= order.step ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(index <= order.step ? BitzzaTheme.forest : BitzzaTheme.muted)
            }
            Button {
                session.advanceSpesaOrder(order.id)
            } label: {
                Text("Simula avanzamento del corriere").fontWeight(.bold).frame(maxWidth: .infinity).padding(14)
                    .foregroundStyle(.white).background(BitzzaTheme.forest).clipShape(RoundedRectangle(cornerRadius: 13))
            }
        }
        .padding(14).background(BitzzaTheme.card).clipShape(RoundedRectangle(cornerRadius: 14))
    }

    private func row(_ title: String, _ value: Double, bold: Bool = false) -> some View {
        HStack {
            Text(title)
            Spacer()
            Text("\(value, specifier: "%.2f") BITZ")
        }
        .font(bold ? .subheadline.bold() : .subheadline)
    }
}
