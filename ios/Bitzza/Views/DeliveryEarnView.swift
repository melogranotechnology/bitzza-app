import SwiftUI

struct DeliveryEarnView: View {
    @EnvironmentObject private var session: SessionStore
    @State private var vehicle: DeliveryVehicle = .bicycle
    @State private var active: DeliveryJob?
    @State private var step = 0

    private let steps = ["Accettata", "Spesa fatta", "In consegna", "Consegnata"]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Fai il corriere SpesaGo e guadagna BITZ demo. Tariffe del prototipo SpesaGo: €/km per mezzo + €0,20/kg, più un bonus di completamento.")
                    .font(.subheadline).foregroundStyle(BitzzaTheme.muted)

                Picker("Mezzo", selection: $vehicle) {
                    ForEach(DeliveryVehicle.allCases) { Label($0.title, systemImage: $0.symbol).tag($0) }
                }
                .pickerStyle(.segmented)
                .disabled(active != nil)

                if let job = active {
                    activeCard(job)
                } else {
                    ForEach(DeliveryDemoFixtures.jobs) { jobCard($0) }
                }

                if !session.deliveries.isEmpty {
                    Text("Consegne completate").font(.headline).padding(.top, 8)
                    ForEach(session.deliveries.prefix(10)) { record in
                        HStack {
                            Image(systemName: record.vehicle.symbol)
                            Text(record.store)
                            Spacer()
                            Text("+\(record.earnings + record.bonus, specifier: "%.2f") BITZ").foregroundStyle(BitzzaTheme.forest)
                        }
                        .font(.subheadline)
                    }
                }

                Text("Simulazione: nessun ordine, corriere o pagamento reale. Massimo \(DeliveryDemoFixtures.maxPerDay) consegne al giorno. La commissione piattaforma SpesaGo dei clienti è \(DeliveryPricing.platformCommissionPercent, specifier: "%.2f")% e non incide sul tuo guadagno.")
                    .font(.caption).foregroundStyle(BitzzaTheme.muted)
            }
            .padding()
        }
        .background(BitzzaTheme.paper)
        .navigationTitle("Consegne")
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

    private func jobCard(_ job: DeliveryJob) -> some View {
        let suitable = DeliveryPricing.isSuitable(vehicle, distanceKm: job.distanceKm)
        let earnings = DeliveryPricing.earnings(vehicle: vehicle, distanceKm: job.distanceKm, weightKg: job.weightKg)
        return VStack(alignment: .leading, spacing: 6) {
            Text(job.store).font(.headline)
            Text(job.area).font(.caption).foregroundStyle(BitzzaTheme.muted)
            HStack {
                Text("\(job.distanceKm, specifier: "%.1f") km · \(job.weightKg, specifier: "%.0f") kg")
                Spacer()
                Text("\(earnings + DeliveryPricing.completionBonus, specifier: "%.2f") BITZ").bold().foregroundStyle(BitzzaTheme.tomato)
            }
            .font(.subheadline)
            Button(suitable ? "Accetta consegna" : "Mezzo non adatto") {
                active = job
                step = 0
            }
            .disabled(!suitable)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(BitzzaTheme.card)
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    private func activeCard(_ job: DeliveryJob) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(job.store).font(.headline)
            ForEach(steps.indices, id: \.self) { index in
                Label(steps[index], systemImage: index <= step ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(index <= step ? BitzzaTheme.forest : BitzzaTheme.muted)
            }
            Button {
                if step < steps.count - 1 {
                    step += 1
                } else {
                    session.completeDelivery(job, vehicle: vehicle)
                    active = nil
                }
            } label: {
                Text(step < steps.count - 1 ? "Avanza: \(steps[step + 1])" : "Concludi e incassa")
                    .fontWeight(.bold).frame(maxWidth: .infinity).padding(14)
                    .foregroundStyle(.white).background(BitzzaTheme.tomato)
                    .clipShape(RoundedRectangle(cornerRadius: 13))
            }
            Button("Annulla consegna", role: .destructive) { active = nil }
        }
        .padding(14)
        .background(BitzzaTheme.card)
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }
}
